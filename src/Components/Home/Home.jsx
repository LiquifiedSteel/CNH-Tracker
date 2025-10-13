// Home.jsx
import { Card, Col, Container, Row, ProgressBar, Spinner, Alert, Button, Form } from "react-bootstrap";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { SHEETS } from "../../redux/sagas/googleSheets.saga"; // adjust path if needed
import "./Home.css";

function Home() {
  const dispatch = useDispatch();

  // ---- Stable, primitive selectors (no inline objects/arrays) ----
  const spreadsheetId    = useSelector((s) => s.sheets?.spreadsheetId);
  const spreadsheetTitle = useSelector((s) => s.sheets?.spreadsheetTitle);
  const rows             = useSelector((s) => s.sheets?.rows);
  const isLoading        = useSelector((s) => s.sheets?.isLoading);
  const rowsError        = useSelector((s) => s.sheets?.rowsError);
  const isLinking        = useSelector((s) => s.sheets?.isLinking);
  const linkError        = useSelector((s) => s.sheets?.linkError);

  const [progress, setProgress] = useState(0);
  const [sheetInput, setSheetInput] = useState("");

    console.log(spreadsheetId);

  // Fetch rows once a sheet is linked
  useEffect(() => {
    if (spreadsheetId) {
      dispatch({ type: SHEETS.ROWS.REQUEST });
    }
  }, [dispatch, spreadsheetId]);

  // Convert rows -> objects using memoization (prevents new refs each render)
  const items = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const [header, ...data] = rows;
    if (!Array.isArray(header)) return [];
    return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r?.[i] ?? ""])));
  }, [rows]);

  // Simple progress from Comment field
  useEffect(() => {
    const total = items.length;
    if (!total) return setProgress(0);
    const done = items.filter((it) => String(it?.Comment || "").toLowerCase().includes("done")).length;
    setProgress(Math.round((done / total) * 100));
  }, [items]);

  const handleLinkSubmit = (e) => {
    e.preventDefault();
    const val = (sheetInput || "").trim();
    if (!val) return;
    dispatch({ type: SHEETS.LINK.REQUEST, payload: { spreadsheetId: val } });
  };

  const showLinkCard = !spreadsheetId;

  return (
    <Container fluid className="home-container">
      <Row>
        <Col>
          <h1 className="page-title">Computer Cleaning</h1>
        </Col>
      </Row>

      {showLinkCard ? (
        <Row>
          <Col xs={12}>
            <Card className="link-card">
              <Card.Body>
                <Card.Title className="mb-2">Link a Google Sheet</Card.Title>
                <Card.Text className="muted-text">
                  Paste a <strong>Spreadsheet ID</strong> or the full Google Sheets <strong>URL</strong> that contains
                  <code> /spreadsheets/d/&lt;ID&gt;/</code>. Make sure you’ve shared the sheet with the service account.
                </Card.Text>

                {linkError && (
                  <Alert variant="danger" className="mb-3">
                    <strong>Failed to link:</strong> {linkError.message || "Unknown error"}
                  </Alert>
                )}

                <Form onSubmit={handleLinkSubmit} className="link-form">
                  <Form.Group controlId="sheetInput">
                    <Form.Label className="form-label">Google Sheet (ID or full URL)</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="https://docs.google.com/spreadsheets/d/1AbC...  or  1AbC..."
                      value={sheetInput}
                      onChange={(e) => setSheetInput(e.target.value)}
                      autoComplete="off"
                      aria-label="Google Sheet ID or URL"
                    />
                  </Form.Group>
                  <div className="form-actions">
                    <Button type="submit" variant="primary" disabled={isLinking}>
                      {isLinking ? "Linking…" : "Link Sheet"}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      ) : (
        <>
          <Row>
            <Col xs={12}>
              <Card className="progress-card">
                <Card.Body>
                  <div className="progress-header">
                    <div className="progress-left">
                      <span className="progress-label">Overall Progress</span>
                      {spreadsheetTitle ? <span className="sheet-title"> · {spreadsheetTitle}</span> : null}
                    </div>
                    <span className="progress-value">{progress}%</span>
                  </div>
                  <ProgressBar now={progress} label={`${progress}%`} />
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {isLoading && (
            <Row className="mb-3">
              <Col xs={12}>
                <div className="loading-wrap">
                  <Spinner animation="border" role="status" />
                  <span className="loading-text">Loading sheet rows…</span>
                </div>
              </Col>
            </Row>
          )}

          {rowsError && (
            <Row className="mb-3">
              <Col xs={12}>
                <Alert variant="danger">
                  <strong>Failed to load rows:</strong> {rowsError.message || "Unknown error"}
                </Alert>
              </Col>
            </Row>
          )}

          {/* Cards below progress bar, in their own Row */}
          <Row className="cards-row">
            {items.map((obj, idx) => (
              <Col key={idx} xs={12} sm={12} md={6} lg={4} className="mb-3">
                <Card className="device-card">
                  <Card.Body>
                    <Card.Title className="device-title">
                      {obj["Device"] || "Device"}
                    </Card.Title>

                    <div className="kv">
                      <span className="k">IP Address</span>
                      <span className="v">{obj["IP Address"] || "-"}</span>
                    </div>

                    <div className="kv">
                      <span className="k">Equipment Type</span>
                      <span className="v">{obj["Equipment Type"] || "-"}</span>
                    </div>

                    <div className="kv">
                      <span className="k">Mfr</span>
                      <span className="v">{obj["Mfr"] || "-"}</span>
                    </div>

                    <div className="kv">
                      <span className="k">Model Name</span>
                      <span className="v">{obj["*Model Name"] || obj["Model Name"] || "-"}</span>
                    </div>

                    <div className="kv">
                      <span className="k">Comment</span>
                      <span className="v">{obj["Comment"] || "-"}</span>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}

            {!isLoading && !rowsError && items.length === 0 && (
              <Col xs={12}>
                <Card className="empty-card">
                  <Card.Body>No rows found in the first sheet tab.</Card.Body>
                </Card>
              </Col>
            )}
          </Row>
        </>
      )}
    </Container>
  );
}

export default Home;