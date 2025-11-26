import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import schema from './schema'
import Project from './models/Project'
import Deployment from './models/Deployment'
import User from './models/User'
import Organisation from './models/Organisation'
import SyncOutbox from './models/SyncOutbox'
import SyncState from './models/SyncState'
import ProjectMember from './models/ProjectMember'
import Device from './models/Device'
import DevicePreparation from './models/DevicePreparation'
// Reference Data Models
import CaptureMethod from './models/CaptureMethod'
import ActivitySensitivity from './models/ActivitySensitivity'
import AiModel from './models/AiModel'
import SamplingDesign from './models/SamplingDesign'

const adapter = new SQLiteAdapter({
    schema,
    // (You might want to comment out migrations if you haven't created them yet)
    // migrations,
    // dbName: 'myapp', // optional, defaults to 'watermelon'
    // jsi: true, // recommended for iOS
    onSetUpError: error => {
        // Database failed to load -- offer the user to reload the app or log out
        console.error('Database setup error:', error)
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
        ProjectMember,
        Device,
        DevicePreparation,
        // Reference Data
        CaptureMethod,
        ActivitySensitivity,
        AiModel,
        SamplingDesign,
    ],
})

export default database
