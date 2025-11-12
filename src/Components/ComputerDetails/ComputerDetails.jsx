// src/components/ComputerDetails.jsx
import {
  Card,
  Col,
  Container,
  Row,
  Spinner,
  Alert,
  Button,
  Form,
} from "react-bootstrap";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { SHEETS } from "../../redux/sagas/googleSheets.saga"; // adjust path if needed
import "../Home/Home.css";

function ComputerDetails() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // --- read device from query string: /computers?id={Device}
  const params = new URLSearchParams(location.search || "");
  const deviceFromQuery = decodeURIComponent(params.get("id") || "").trim();

  // --- Redux state
  const spreadsheetId       = useSelector((s) => s.sheets?.spreadsheetId);
  const rows                = useSelector((s) => s.sheets?.rows);
  const isLoading           = useSelector((s) => s.sheets?.isLoading);
  const rowsError           = useSelector((s) => s.sheets?.rowsError);
  const updatingDevice      = useSelector((s) => s.sheets?.updatingDevice);
  const updatingCommentFor  = useSelector((s) => s.sheets?.updatingCommentFor);

  // If we have a linked sheet but no rows yet, fetch them
  useEffect(() => {
    if (spreadsheetId && (!Array.isArray(rows) || rows.length === 0)) {
      dispatch({ type: SHEETS.ROWS.REQUEST });
    }
  }, [dispatch, spreadsheetId, rows]);

  // Convert raw rows -> object array
  const items = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const [header, ...data] = rows;
    if (!Array.isArray(header)) return [];
    return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r?.[i] ?? ""])));
  }, [rows]);

  // helper to filter out empty rows
  const isNonEmptyRow = (obj) =>
    obj && Object.values(obj).some((v) => String(v ?? "").trim() !== "");

  const displayItems = useMemo(() => items.filter(isNonEmptyRow), [items]);

  // Find the device (case-insensitive, trimmed)
  const deviceKey = deviceFromQuery.toLowerCase();
  const record = useMemo(() => {
    if (!deviceKey) return null;
    return (
      displayItems.find(
        (it) => String(it?.Device || "").trim().toLowerCase() === deviceKey
      ) || null
    );
  }, [displayItems, deviceKey]);

  const isTrue = (v) => (typeof v === "boolean" ? v : String(v ?? "").trim().toLowerCase() === "true");
  const completed = isTrue(record?.Completed);

  // --- Comment editing ---
  const [commentDraft, setCommentDraft] = useState(record?.Comment || "");
  useEffect(() => {
    setCommentDraft(record?.Comment || "");
  }, [record]);

  const saveComment = () => {
    const d = String(record?.Device || "").trim();
    if (!d) return;
    dispatch({ type: SHEETS.COMMENT_UPDATE.REQUEST, payload: { device: d, comment: commentDraft } });
  };

  // --- Complete / Incomplete toggles ---
  const toggleComplete = () => {
    const d = String(record?.Device || "").trim();
    if (!d) return;
    if (completed) {
      dispatch({ type: SHEETS.INCOMPLETE.REQUEST, payload: { device: d } });
    } else {
      dispatch({ type: SHEETS.COMPLETE.REQUEST, payload: { device: d } });
    }
  };

  const goBack = () => navigate("/home");

  const isUpdatingThisDevice =
    updatingDevice && String(updatingDevice).trim().toLowerCase() === deviceKey;
  const isSavingThisComment =
    updatingCommentFor && String(updatingCommentFor).trim().toLowerCase() === deviceKey;

  return (
    <Container fluid className="home-container">
      <Row>
        <Col>
          <h1 className="page-title">Computer Details</h1>
        </Col>
      </Row>

      {/* Action buttons */}
      <Row className="mb-3">
        <Col xs={6}>
          <Button
            variant="outline-secondary"
            className="w-100"
            onClick={goBack}
            aria-label="Back to Home"
          >
            ← Back
          </Button>
        </Col>
        <Col xs={6}>
          <Button
            variant={completed ? "outline-warning" : "success"}
            className="w-100"
            onClick={toggleComplete}
            aria-label={completed ? "Mark Pending" : "Mark Complete"}
            disabled={isUpdatingThisDevice}
          >
            {isUpdatingThisDevice ? "Updating…" : completed ? "Mark Pending" : "Complete"}
          </Button>
        </Col>
      </Row>

      {/* Loading / error states */}
      {isLoading && (
        <Row className="mb-3">
          <Col xs={12}>
            <div className="loading-wrap">
              <Spinner animation="border" role="status" />
              <span className="loading-text">Loading device…</span>
            </div>
          </Col>
        </Row>
      )}
      {rowsError && (
        <Row className="mb-3">
          <Col xs={12}>
            <Alert variant="danger">
              <strong>Failed to load data:</strong> {rowsError.message || "Unknown error"}
            </Alert>
          </Col>
        </Row>
      )}

      {/* Main details card */}
      {!isLoading && !rowsError && (
        <Row>
          <Col xs={12}>
            {record ? (
              <Card className="device-card" style={{
                backgroundColor: completed ? "rgba(40, 167, 69, 0.10)" : undefined,
                borderColor: completed ? "rgba(40, 167, 69, 0.35)" : undefined,
              }}>
                <Card.Body>
                  <Card.Title className="device-title">
                    {record["Device"] || "Device"}
                  </Card.Title>

                  <div className="kv">
                    <span className="k">IP Address</span>
                    <span className="v">{record["IP Address"] || "-"}</span>
                  </div>

                  <div className="kv">
                    <span className="k">Equipment Type</span>
                    <span className="v">{record["Equipment Type"] || "-"}</span>
                  </div>

                  <div className="kv">
                    <span className="k">Mfr</span>
                    <span className="v">{record["Mfr"] || "-"}</span>
                  </div>

                  <div className="kv">
                    <span className="k">Model Name</span>
                    <span className="v">
                      {record["*Model Name"] || record["Model Name"] || "-"}
                    </span>
                  </div>

                  <div className="kv">
                    <span className="k">Completed</span>
                    <span className="v">{completed ? "true" : "false"}</span>
                  </div>

                  {/* Comment editor */}
                  <Form className="mt-3">
                    <Form.Group controlId="commentField">
                      <Form.Label>Comment</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Add a note…"
                      />
                    </Form.Group>
                    <div className="d-flex justify-content-end mt-2">
                      <Button
                        variant="primary"
                        onClick={saveComment}
                        disabled={isSavingThisComment}
                        aria-label="Save Comment"
                      >
                        {isSavingThisComment ? "Saving…" : "Save Comment"}
                      </Button>
                    </div>
                  </Form>
                </Card.Body>
              </Card>
            ) : (
              <Card className="empty-card">
                <Card.Body>
                  {deviceFromQuery
                    ? `No computer found with name "${deviceFromQuery}".`
                    : "No device id provided in the URL (use /computers?id={Device})."}
                </Card.Body>
              </Card>
            )}
          </Col>
        </Row>
      )}
    </Container>
  );
}

export default ComputerDetails;