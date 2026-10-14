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

// Each screen group contributes a rows table; add new groups here.
const ALL: Rows = { ...common, ...timeAttendance, ...salary, ...profileDocs, ...leads, ...requests, ...goods, ...tasksCore, ...taskParts };
export default buildDicts(ALL);
