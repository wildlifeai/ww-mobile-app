/**
 * An archived project is out of the app's project list and the pickers that
 * start a deployment (#191). The services keep it, so its deployments and
 * cameras still show on the map and in the device lists. Unarchiving goes
 * through the Wildlife Watcher team, so nothing in the app needs to list it.
 */
export const withoutArchived = <T extends { is_archived?: boolean | null }>(projects: T[]): T[] =>
    projects.filter(project => !project.is_archived)
