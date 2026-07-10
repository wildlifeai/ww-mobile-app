import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId'
import * as Crypto from 'expo-crypto'

import schema from './schema'
import Project from './models/Project'
import Deployment from './models/Deployment'
import User from './models/User'
import Organisation from './models/Organisation'
import SyncOutbox from './models/SyncOutbox'
import SyncState from './models/SyncState'
import UserRole from './models/UserRole'
import ProjectInvitation from './models/ProjectInvitation'
import Device from './models/Device'
import Firmware from './models/Firmware'
// Reference Data Models
import CaptureMethod from './models/CaptureMethod'
import ActivitySensitivity from './models/ActivitySensitivity'
import AiModel from './models/AiModel'
import AiModelFamily from './models/AiModelFamily'
import SamplingDesign from './models/SamplingDesign'
import { logError } from '../utils/logger'


// NOTE on schema versioning: this adapter deliberately configures NO
// `migrations`. WatermelonDB's behaviour without migrations is to RESET the
// local database (wipe + recreate from `schema`) whenever `schema.version`
// changes - it does not crash or fail to open. That is acceptable here
// because the local DB is a sync cache regenerated from the backend
// (schema.ts itself is auto-generated from the Supabase schema, and versions
// are bumped in lock-step with backend syncs). The one caveat: any pending
// SyncOutbox entries are lost on a version bump, so avoid bumping the schema
// version in releases where offline-queued writes are likely in flight.
const adapter = new SQLiteAdapter({
    schema,
    onSetUpError: error => {
        // Database failed to load -- offer the user to reload the app or log out
        logError('Database setup error:', error)
    }
})

const database = new Database({
    adapter,
    modelClasses: [
        Project,
        Deployment,
        User,
        Organisation,
        SyncOutbox,
        SyncState,
        UserRole,
        ProjectInvitation,
        Device,
        Firmware,
        // Reference Data
        CaptureMethod,
        ActivitySensitivity,
        AiModel,
        AiModelFamily,
        SamplingDesign,
    ],
})

// ⚡️ VITAL: Override the default ID generator with the native crypto UUID
setGenerator(() => Crypto.randomUUID())

export default database
