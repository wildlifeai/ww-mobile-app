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
import DevicePreparation from './models/DevicePreparation'
import Firmware from './models/Firmware'
// Reference Data Models
import CaptureMethod from './models/CaptureMethod'
import ActivitySensitivity from './models/ActivitySensitivity'
import AiModel from './models/AiModel'
import SamplingDesign from './models/SamplingDesign'

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
        DevicePreparation,
        Firmware,
        // Reference Data
        CaptureMethod,
        ActivitySensitivity,
        AiModel,
        SamplingDesign,
    ],
})

// ⚡️ VITAL: Override the default ID generator with the native crypto UUID
setGenerator(() => Crypto.randomUUID())

export default database
