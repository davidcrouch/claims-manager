import { IsString, IsOptional, IsBoolean, IsNumber, IsDateString } from 'class-validator';

export class UpdateAssessmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  jobId?: string;

  @IsOptional()
  @IsString()
  claimRecommendation?: string;

  @IsOptional()
  @IsBoolean()
  makeSafe?: boolean;

  @IsOptional()
  @IsString()
  makeSafeType?: string;

  @IsOptional()
  @IsString()
  designType?: string;

  @IsOptional()
  @IsString()
  construction?: string;

  @IsOptional()
  @IsString()
  roofType?: string;

  @IsOptional()
  @IsString()
  buildingType?: string;

  @IsOptional()
  @IsNumber()
  squares?: number;

  @IsOptional()
  @IsNumber()
  buildingAge?: number;

  @IsOptional()
  @IsNumber()
  squareMetres?: number;

  @IsOptional()
  @IsDateString()
  dateBooked?: string;

  @IsOptional()
  @IsBoolean()
  overallConditionAcceptable?: boolean;

  @IsOptional()
  @IsBoolean()
  iagInspectionRequired?: boolean;

  @IsOptional()
  @IsDateString()
  makeSafeCompletionDate?: string;

  @IsOptional()
  @IsBoolean()
  mainRoofDamage?: boolean;

  @IsOptional()
  @IsDateString()
  dateMainRoofRepaired?: string;

  @IsOptional()
  @IsBoolean()
  habitable?: boolean;

  @IsOptional()
  @IsBoolean()
  mould?: boolean;

  @IsOptional()
  @IsBoolean()
  asbestosOnSite?: boolean;

  @IsOptional()
  @IsBoolean()
  detachedGarage?: boolean;

  @IsOptional()
  @IsBoolean()
  sheds?: boolean;

  @IsOptional()
  @IsBoolean()
  swimmingPool?: boolean;

  @IsOptional()
  @IsBoolean()
  detachedGrannyFlat?: boolean;

  @IsOptional()
  @IsBoolean()
  damageCausedByListedEvent?: boolean;

  @IsOptional()
  @IsBoolean()
  hazardPoolFencing?: boolean;

  @IsOptional()
  @IsString()
  hazardPoolFencingComment?: string;

  @IsOptional()
  @IsBoolean()
  hazardElectricalGas?: boolean;

  @IsOptional()
  @IsString()
  hazardElectricalGasComment?: string;

  @IsOptional()
  @IsBoolean()
  hazardSewerage?: boolean;

  @IsOptional()
  @IsString()
  hazardSewerageComment?: string;

  @IsOptional()
  @IsBoolean()
  hazardStructural?: boolean;

  @IsOptional()
  @IsString()
  hazardStructuralComment?: string;

  @IsOptional()
  @IsString()
  hazardOther?: string;

  @IsOptional()
  @IsBoolean()
  tempAccomRequiredImmediately?: boolean;

  @IsOptional()
  @IsNumber()
  tempAccomImmediateEstimateDays?: number;

  @IsOptional()
  @IsString()
  tempRepairsToMakeLivable?: string;

  @IsOptional()
  @IsBoolean()
  tempAccomRequiredDuringRepairs?: boolean;

  @IsOptional()
  @IsNumber()
  tempAccomRepairsEstimateDays?: number;

  @IsOptional()
  @IsString()
  workWhileInAccommodation?: string;

  @IsOptional()
  @IsString()
  clientDiscussion?: string;

  @IsOptional()
  @IsString()
  resultantDamage?: string;

  @IsOptional()
  @IsString()
  causeOfDamage?: string;

  @IsOptional()
  @IsString()
  maintenanceRelatedIssues?: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsString()
  variancesOfScope?: string;
}
