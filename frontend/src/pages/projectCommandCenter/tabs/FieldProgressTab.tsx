import ProjectTaskManager from "./ProjectTaskManager";

/**
 * Project → Execution → Tasks: the status board (To do / In progress / Needs approval / Done).
 * Each card shows its % progress, the team, assign actions and a link to the full execution
 * report page (start/end time, who worked, check-ins, work steps, photos, materials, issues).
 */
export default function FieldProgressTab({ projectId, fieldTasks, onChanged, onAddTask }: {
  projectId: number;
  fieldTasks: any[];
  onChanged?: () => void;
  onAddTask?: () => void;
}) {
  return <ProjectTaskManager projectId={projectId} fieldTasks={fieldTasks} onChanged={onChanged} onAddTask={onAddTask} />;
}
