ALTER TABLE assessments DROP CONSTRAINT IF EXISTS chk_assessment_status;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessments'
      AND column_name = 'make_safe' AND data_type = 'boolean'
  ) THEN
    ALTER TABLE assessments RENAME COLUMN make_safe TO make_safe_flag;
  END IF;
END $$;

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS attendance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS building jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS habitability jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hazards jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS damage jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS make_safe jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS temporary_accommodation jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS specialists jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recommendation jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS extras jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS report_external_reference text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessments' AND column_name = 'claim_recommendation'
  ) THEN
    UPDATE assessments SET
      attendance = jsonb_strip_nulls(jsonb_build_object(
        'siteAttendanceDate', date_booked,
        'insuranceAssessorAttended', iag_inspection_required
      )),
      building = jsonb_strip_nulls(jsonb_build_object(
        'houseM2', CASE WHEN square_metres IS NOT NULL THEN square_metres::float ELSE NULL END,
        'estimatedBuildYear', CASE WHEN building_age IS NOT NULL THEN building_age::text ELSE NULL END,
        'buildingType', building_type,
        'designType', design_type,
        'constructionType', construction,
        'roofType', roof_type,
        'mainHouseRoofDamage', main_roof_damage,
        'additionalStructures', NULLIF(concat_ws(', ',
          CASE WHEN detached_garage THEN 'Detached Garage' END,
          CASE WHEN sheds THEN 'Sheds' END,
          CASE WHEN swimming_pool THEN 'Swimming Pool' END,
          CASE WHEN detached_granny_flat THEN 'Granny Flat' END
        ), ''),
        'propertyCondition', overall_condition_acceptable,
        'squares', squares
      )),
      habitability = jsonb_strip_nulls(jsonb_build_object(
        'habitable', habitable
      )),
      hazards = jsonb_strip_nulls(jsonb_build_object(
        'safetyHazards', NULLIF(concat_ws('; ',
          CASE WHEN hazard_pool_fencing THEN 'Pool fencing' || CASE WHEN COALESCE(hazard_pool_fencing_comment, '') <> '' THEN ': ' || hazard_pool_fencing_comment ELSE '' END END,
          CASE WHEN hazard_electrical_gas THEN 'Electrical / Gas' || CASE WHEN COALESCE(hazard_electrical_gas_comment, '') <> '' THEN ': ' || hazard_electrical_gas_comment ELSE '' END END,
          CASE WHEN hazard_sewerage THEN 'Sewerage' || CASE WHEN COALESCE(hazard_sewerage_comment, '') <> '' THEN ': ' || hazard_sewerage_comment ELSE '' END END,
          CASE WHEN hazard_structural THEN 'Structural' || CASE WHEN COALESCE(hazard_structural_comment, '') <> '' THEN ': ' || hazard_structural_comment ELSE '' END END,
          CASE WHEN COALESCE(hazard_other, '') <> '' THEN 'Other: ' || hazard_other END,
          CASE WHEN asbestos_on_site THEN 'Asbestos' END
        ), ''),
        'environmentalHazards', NULLIF(concat_ws('; ',
          CASE WHEN mould THEN 'Mould' END,
          CASE WHEN asbestos_on_site THEN 'Asbestos' END
        ), ''),
        'hazardDetails', jsonb_strip_nulls(jsonb_build_object(
          'poolFencing', jsonb_build_object('flagged', hazard_pool_fencing, 'comment', hazard_pool_fencing_comment),
          'electrical', jsonb_build_object('flagged', hazard_electrical_gas, 'comment', hazard_electrical_gas_comment),
          'sewerage', jsonb_build_object('flagged', hazard_sewerage, 'comment', hazard_sewerage_comment),
          'structural', jsonb_build_object('flagged', hazard_structural, 'comment', hazard_structural_comment),
          'other', hazard_other
        ))
      )),
      damage = jsonb_strip_nulls(jsonb_build_object(
        'damageObserved', resultant_damage,
        'causeOfDamage', cause_of_damage,
        'hasDamageCoveredByPolicy', CASE WHEN damage_caused_by_listed_event THEN 'Yes' ELSE 'No' END,
        'preExistingMaintenanceIssues', COALESCE(maintenance_related_issues, '') <> '',
        'maintenanceDefectIssues', maintenance_related_issues
      )),
      make_safe = jsonb_strip_nulls(jsonb_build_object(
        'makeSafeRequired', make_safe_flag,
        'makeSafeType', make_safe_type,
        'dateMakeSafeCompleted', make_safe_completion_date,
        'dateMainRoofRepaired', date_main_roof_repaired
      )),
      temporary_accommodation = jsonb_strip_nulls(jsonb_build_object(
        'required', CASE
          WHEN temp_accom_required_immediately OR temp_accom_required_during_repairs THEN 'Yes, Temporary Accommodation'
          ELSE 'No'
        END,
        'requiredImmediately', temp_accom_required_immediately,
        'immediateEstimateDays', temp_accom_immediate_estimate_days,
        'requiredDuringRepairs', temp_accom_required_during_repairs,
        'repairsEstimateDays', temp_accom_repairs_estimate_days,
        'tempRepairsToMakeLivable', temp_repairs_to_make_livable,
        'workWhileInAccommodation', work_while_in_accommodation,
        'estimatedDuration', CASE
          WHEN temp_accom_immediate_estimate_days IS NOT NULL THEN temp_accom_immediate_estimate_days::text || ' Days'
          WHEN temp_accom_repairs_estimate_days IS NOT NULL THEN temp_accom_repairs_estimate_days::text || ' Days'
          ELSE NULL
        END
      )),
      recommendation = jsonb_strip_nulls(jsonb_build_object(
        'claimRecommendation', claim_recommendation,
        'clientDiscussions', client_discussion,
        'specialNotes', comments,
        'conclusion', variances_of_scope
      ))
    WHERE deleted_at IS NULL;
  END IF;
END $$;

ALTER TABLE assessments
  DROP COLUMN IF EXISTS make_safe_flag,
  DROP COLUMN IF EXISTS claim_recommendation,
  DROP COLUMN IF EXISTS make_safe_type,
  DROP COLUMN IF EXISTS design_type,
  DROP COLUMN IF EXISTS construction,
  DROP COLUMN IF EXISTS roof_type,
  DROP COLUMN IF EXISTS building_type,
  DROP COLUMN IF EXISTS squares,
  DROP COLUMN IF EXISTS building_age,
  DROP COLUMN IF EXISTS square_metres,
  DROP COLUMN IF EXISTS date_booked,
  DROP COLUMN IF EXISTS overall_condition_acceptable,
  DROP COLUMN IF EXISTS iag_inspection_required,
  DROP COLUMN IF EXISTS make_safe_completion_date,
  DROP COLUMN IF EXISTS main_roof_damage,
  DROP COLUMN IF EXISTS date_main_roof_repaired,
  DROP COLUMN IF EXISTS habitable,
  DROP COLUMN IF EXISTS mould,
  DROP COLUMN IF EXISTS asbestos_on_site,
  DROP COLUMN IF EXISTS detached_garage,
  DROP COLUMN IF EXISTS sheds,
  DROP COLUMN IF EXISTS swimming_pool,
  DROP COLUMN IF EXISTS detached_granny_flat,
  DROP COLUMN IF EXISTS damage_caused_by_listed_event,
  DROP COLUMN IF EXISTS hazard_pool_fencing,
  DROP COLUMN IF EXISTS hazard_pool_fencing_comment,
  DROP COLUMN IF EXISTS hazard_electrical_gas,
  DROP COLUMN IF EXISTS hazard_electrical_gas_comment,
  DROP COLUMN IF EXISTS hazard_sewerage,
  DROP COLUMN IF EXISTS hazard_sewerage_comment,
  DROP COLUMN IF EXISTS hazard_structural,
  DROP COLUMN IF EXISTS hazard_structural_comment,
  DROP COLUMN IF EXISTS hazard_other,
  DROP COLUMN IF EXISTS temp_accom_required_immediately,
  DROP COLUMN IF EXISTS temp_accom_immediate_estimate_days,
  DROP COLUMN IF EXISTS temp_repairs_to_make_livable,
  DROP COLUMN IF EXISTS temp_accom_required_during_repairs,
  DROP COLUMN IF EXISTS temp_accom_repairs_estimate_days,
  DROP COLUMN IF EXISTS work_while_in_accommodation,
  DROP COLUMN IF EXISTS client_discussion,
  DROP COLUMN IF EXISTS resultant_damage,
  DROP COLUMN IF EXISTS cause_of_damage,
  DROP COLUMN IF EXISTS maintenance_related_issues,
  DROP COLUMN IF EXISTS comments,
  DROP COLUMN IF EXISTS variances_of_scope;

ALTER TABLE assessments DROP CONSTRAINT IF EXISTS chk_assessment_status;
ALTER TABLE assessments ADD CONSTRAINT chk_assessment_status
  CHECK (status IN ('draft', 'in_progress', 'submitted', 'reviewed', 'published', 'archived'));
