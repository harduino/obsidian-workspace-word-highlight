## MODIFIED Requirements

### Requirement: Settings compatibility
The plugin SHALL load previous data by merging saved settings with defaults, including `androidSelectionGuard`, and retain existing settings keys and CSS classes. For the first public release it SHALL register plugin-agnostic command IDs `toggle-highlighting` and `clear-highlighting` without migration aliases for unpublished local IDs.

#### Scenario: Older saved data
- **WHEN** saved data lacks the Android guard key
- **THEN** the default enabled value is used

#### Scenario: First public command registration
- **WHEN** the plugin loads
- **THEN** it registers only `toggle-highlighting` and `clear-highlighting`, and the callbacks still toggle the enabled state and clear marks
