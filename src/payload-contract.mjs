export const PAYLOAD_VERSION = 1;
export const PAYLOAD_TYPES = Object.freeze(["prompt", "dataset", "industry"]);
export const PAYLOAD_ROLES = Object.freeze(["course", "external"]);

export const START_MARKER = "<!-- kitomat:payload:v1 -->";
export const END_MARKER = "<!-- /kitomat:payload -->";

export const MAX_PAYLOAD_BYTES = 32 * 1024;
export const MAX_SUMMARY_CHARS = 8_000;
export const MAX_ISSUE_BODY_CHARS = 55_000;
export const MAX_PREFILL_URL_CHARS = 1_500;

export const TOP_LEVEL_FIELDS = Object.freeze([
  "v",
  "type",
  "role",
  "answers",
  "acknowledgements"
]);

export const ACKNOWLEDGEMENT_FIELDS = Object.freeze([
  "public_content_confirmed",
  "no_real_personal_data_confirmed",
  "pii_hints_reviewed"
]);

const COMMON_ANSWER_TYPES = Object.freeze({
  id: "string",
  title: "string",
  category: "string",
  language: "string",
  maintainer: "string",
  license: "string",
  license_status: "string",
  data_risk: "string",
  ai_act_proximity: "string",
  sources_status: "string",
  scenario_positive: "string",
  scenario_rework: "string",
  scenario_negative: "string",
  failure_modes: "stringArray"
});

export const ANSWER_TYPES = Object.freeze({
  prompt: Object.freeze({
    ...COMMON_ANSWER_TYPES,
    target_users: "stringArray",
    use_case: "string",
    required_inputs: "stringArray",
    output_format: "string",
    personal_data_possible: "boolean",
    evaluation_criteria: "string",
    prompt_text: "string",
    sample_input: "string",
    sample_output: "string",
    sources: "array"
  }),
  dataset: Object.freeze({
    ...COMMON_ANSWER_TYPES,
    linked_artifacts: "stringArray",
    data_origin: "string",
    contains_personal_data: "boolean",
    contains_sensitive_data: "boolean",
    sources_date: "string",
    usage_scope: "string",
    release_asset_required: "boolean",
    release_asset_name: "string",
    release_asset_version: "string",
    release_asset_size_mb: "string",
    release_asset_sha256: "string",
    release_asset_url: "string",
    dataset_description: "string",
    sources: "array"
  }),
  industry: Object.freeze({
    ...COMMON_ANSWER_TYPES,
    model_type: "string",
    target_users: "stringArray",
    use_case: "string",
    required_inputs: "stringArray",
    output_format: "string",
    application_scope: "string",
    framework_references: "stringArray",
    required_review_level: "string",
    model_description: "string",
    application_guide: "string",
    sample_case: "string",
    sources: "array"
  })
});
