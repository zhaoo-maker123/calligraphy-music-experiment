const COLUMNS = [
  "record_type",
  "session_id",
  "experiment_status",
  "section_order",
  "section_id",
  "question_order",
  "question_id",
  "question_type",
  "question_status",
  "stroke_number",
  "selected_states",
  "selected_option",
  "selected_asset",
  "started_at",
  "ended_at",
  "exported_at",
];

function escapeCsv(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsvRow(record) {
  return COLUMNS.map((column) => escapeCsv(record[column])).join(",");
}

export function buildCsv(session, tasks, exportedAt = new Date()) {
  const exportTimestamp = exportedAt.toISOString();
  const rows = [{
    record_type: "session",
    session_id: session.sessionId,
    experiment_status: session.status,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    exported_at: exportTimestamp,
  }];

  tasks.forEach((task) => {
    const response = session.responses[task.id];
    if (!response) return;

    const shared = {
      session_id: session.sessionId,
      experiment_status: session.status,
      section_order: task.sectionOrder,
      section_id: task.sectionId,
      question_order: task.questionOrder,
      question_id: task.id,
      question_type: task.kind,
      question_status: response.status,
      started_at: session.startedAt,
      ended_at: session.endedAt,
      exported_at: exportTimestamp,
    };

    if (task.kind === "trace" || task.kind === "audio-trace") {
      response.strokes.forEach((stroke) => {
        rows.push({
          ...shared,
          record_type: "stroke",
          stroke_number: stroke.strokeNumber,
          selected_states: stroke.states.join("|"),
          selected_asset: task.itemValue,
        });
      });
      return;
    }

    rows.push({
      ...shared,
      record_type: "choice",
      selected_option: response.selectedOption,
      selected_asset: response.selectedValue,
    });
  });

  return [COLUMNS.join(","), ...rows.map(toCsvRow)].join("\r\n");
}
