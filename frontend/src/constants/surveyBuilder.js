export const QUESTION_TYPE_GROUPS = [
  {
    id: 'basic',
    label: 'Basic',
    description: 'Fast inputs for common form flows.',
    types: [
      'multiple_choice_single',
      'multiple_choice_multi',
      'dropdown',
      'short_text',
      'open_ended',
      'long_text',
      'yes_no',
    ],
  },
  {
    id: 'rating',
    label: 'Rating & Scale',
    description: 'Scores, sentiment, and prioritization.',
    types: ['star_rating', 'rating_scale', 'nps', 'constant_sum'],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Richer formats for deeper analysis.',
    types: ['matrix', 'matrix_plus', 'ranking', 'image_choice', 'file_upload', 'date_time', 'demographics'],
  },
  {
    id: 'structure',
    label: 'Structure',
    description: 'Guide respondents through the experience.',
    types: ['section_heading', 'instructional_text'],
  },
]

export const QUESTION_TYPE_META = {
  multiple_choice_single: {
    label: 'Multiple Choice',
    shortLabel: 'Single Select',
    category: 'basic',
  },
  multiple_choice_multi: {
    label: 'Checkboxes',
    shortLabel: 'Multi Select',
    category: 'basic',
  },
  dropdown: {
    label: 'Dropdown',
    shortLabel: 'Dropdown',
    category: 'basic',
  },
  short_text: {
    label: 'Short Text',
    shortLabel: 'Short Text',
    category: 'basic',
  },
  open_ended: {
    label: 'Open Ended',
    shortLabel: 'Open Ended',
    category: 'basic',
  },
  long_text: {
    label: 'Long Text',
    shortLabel: 'Long Text',
    category: 'basic',
  },
  yes_no: {
    label: 'Yes / No',
    shortLabel: 'Yes / No',
    category: 'basic',
  },
  rating_scale: {
    label: 'Rating Scale',
    shortLabel: 'Scale',
    category: 'rating',
  },
  star_rating: {
    label: 'Star Rating',
    shortLabel: 'Stars',
    category: 'rating',
  },
  nps: {
    label: 'NPS',
    shortLabel: 'NPS',
    category: 'rating',
  },
  constant_sum: {
    label: 'Constant Sum',
    shortLabel: 'Constant Sum',
    category: 'rating',
  },
  date_time: {
    label: 'Date & Time',
    shortLabel: 'Date / Time',
    category: 'advanced',
  },
  matrix: {
    label: 'Matrix',
    shortLabel: 'Matrix',
    category: 'advanced',
  },
  matrix_plus: {
    label: 'Matrix+',
    shortLabel: 'Matrix+',
    category: 'advanced',
  },
  ranking: {
    label: 'Ranking',
    shortLabel: 'Ranking',
    category: 'advanced',
  },
  image_choice: {
    label: 'Image Choice',
    shortLabel: 'Images',
    category: 'advanced',
  },
  file_upload: {
    label: 'File Upload',
    shortLabel: 'Upload',
    category: 'advanced',
  },
  demographics: {
    label: 'Demographics',
    shortLabel: 'Demographics',
    category: 'advanced',
  },
  section_heading: {
    label: 'Section Heading',
    shortLabel: 'Heading',
    category: 'structure',
  },
  instructional_text: {
    label: 'Instructional Text',
    shortLabel: 'Text Block',
    category: 'structure',
  },
}

export const STATUS_BADGE_VARIANTS = {
  draft: 'secondary',
  active: 'success',
  paused: 'warning',
  closed: 'danger',
}

export const SURVEY_DEVICE_MODES = [
  { value: 'desktop', label: 'Desktop', className: 'max-w-5xl' },
  { value: 'tablet', label: 'Tablet', className: 'max-w-3xl' },
  { value: 'mobile', label: 'Mobile', className: 'max-w-md' },
]

export const DEMOGRAPHIC_FIELDS = [
  'name',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'zip',
  'country',
]
