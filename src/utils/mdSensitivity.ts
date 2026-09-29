/**
 * op17 (MD_SENSITIVITY) level for a project's activity sensitivity.
 *
 * Mirrors MD_SENSITIVITY_CONFIG_E in the Himax firmware (cisdp_sensor.h):
 * 0 off, 1 low, 2 medium, 3 high. Takes the activity_sensitivity row's
 * `value`, never its id, because ids are not the same on every tier. A
 * project with no sensitivity, or one this build does not know, gets
 * medium, the database default. 0 is not returned: turning motion
 * detection off belongs to the capture method, not to sensitivity.
 */
export function mdSensitivityLevel(value?: string | null): 1 | 2 | 3 {
	switch (value?.trim().toLowerCase()) {
		case 'low':
			return 1
		case 'high':
			return 3
		default:
			return 2
	}
}
