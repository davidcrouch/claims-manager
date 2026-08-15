'use client';

import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  Home,
  ShieldAlert,
  Stethoscope,
  Users,
  Wrench,
} from 'lucide-react';
import { createAssessmentTabDrawer } from './AssessmentTabDrawer';
import {
  AttendanceTabForm,
  BuildingTabForm,
  HabitabilityTabForm,
  HazardsTabForm,
  DamageTabForm,
  MakeSafeTabForm,
  TempAccommodationTabForm,
  SpecialistsTabForm,
  RecommendationTabForm,
} from '../tabs';

export const AssessmentAttendanceDrawer = createAssessmentTabDrawer({
  sectionKey: 'attendance',
  title: 'Attendance',
  icon: Users,
  FormComponent: AttendanceTabForm,
});

export const AssessmentBuildingTabDrawer = createAssessmentTabDrawer({
  sectionKey: 'building',
  title: 'Building',
  icon: Building2,
  FormComponent: BuildingTabForm,
});

export const AssessmentHabitabilityDrawer = createAssessmentTabDrawer({
  sectionKey: 'habitability',
  title: 'Habitability',
  icon: Home,
  FormComponent: HabitabilityTabForm,
});

export const AssessmentHazardsTabDrawer = createAssessmentTabDrawer({
  sectionKey: 'hazards',
  title: 'Hazards',
  icon: AlertTriangle,
  FormComponent: HazardsTabForm,
});

export const AssessmentDamageDrawer = createAssessmentTabDrawer({
  sectionKey: 'damage',
  title: 'Damage & Cause',
  icon: ShieldAlert,
  FormComponent: DamageTabForm,
});

export const AssessmentMakeSafeDrawer = createAssessmentTabDrawer({
  sectionKey: 'makeSafe',
  title: 'Make Safe',
  icon: Wrench,
  FormComponent: MakeSafeTabForm,
});

export const AssessmentTempAccommodationDrawer = createAssessmentTabDrawer({
  sectionKey: 'temporaryAccommodation',
  title: 'Temp Accommodation',
  icon: Home,
  FormComponent: TempAccommodationTabForm,
});

export const AssessmentSpecialistsDrawer = createAssessmentTabDrawer({
  sectionKey: 'specialists',
  title: 'Specialists',
  icon: Stethoscope,
  FormComponent: SpecialistsTabForm,
});

export const AssessmentRecommendationDrawer = createAssessmentTabDrawer({
  sectionKey: 'recommendation',
  title: 'Recommendation',
  icon: ClipboardCheck,
  FormComponent: RecommendationTabForm,
});
