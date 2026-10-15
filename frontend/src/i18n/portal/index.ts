import { buildDicts, Rows } from './build';
import common from './common';
import timeAttendance from './timeAttendance';
import salary from './salary';
import profileDocs from './profileDocs';
import leads from './leads';
import requests from './requests';
import goods from './goods';
import tasksCore from './tasksCore';
import taskParts from './taskParts';
import taskLead from './taskLead';
import taskReq from './taskReq';
import taskOrder from './taskOrder';

import taskProject from './taskProject';
import taskForm from './taskForm';
import taskDetail from './taskDetail';
// Each screen group contributes a rows table; add new groups here.
const ALL: Rows = { ...taskDetail, ...taskForm, ...taskProject, ...common, ...timeAttendance, ...salary, ...profileDocs, ...leads, ...requests, ...goods, ...tasksCore, ...taskParts, ...taskLead, ...taskReq, ...taskOrder };
export default buildDicts(ALL);
