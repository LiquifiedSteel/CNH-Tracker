// Total.jsx
import {
  Card,
  Col,
  Container,
  Row,
  Spinner,
  Alert,
  Form,
  Button,
  InputGroup,
} from "react-bootstrap";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { SHEETS } from "../../redux/sagas/googleSheets.saga"; // adjust path if needed
import useSheetSearch from "../../hooks/useSheetSearch";
import "../Home/Home.css"; // reuse existing styles

function Total() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // ---- Redux state ----
  const spreadsheetId  = useSelector((s) => s.sheets?.spreadsheetId);
  const rows           = useSelector((s) => s.sheets?.rows);
  const isLoading      = useSelector((s) => s.sheets?.isLoading);
  const rowsError      = useSelector((s) => s.sheets?.rowsError);
  const updatingDevice = useSelector((s) => s.sheets?.updatingDevice); // for disabling while updating

  // Fetch rows if we have a linked sheet but no data yet
  useEffect(() => {
    if (spreadsheetId && (!Array.isArray(rows) || rows.length === 0)) {
      dispatch({ type: SHEETS.ROWS.REQUEST });
    }
  }, [dispatch, spreadsheetId, rows]);

  // ---- Transform + search (filters empty rows; checks all fields) ----
  const { query, setQuery, filtered, normalizedQuery } = useSheetSearch(rows);

  const handleSearchChange = (e) => setQuery(e.target.value);

  const isTrue = (v) => (typeof v === "boolean" ? v : String(v ?? "").trim().toLowerCase() === "true");
  const ciEq = (a, b) =>
    String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

  // Dispatch saga to mark as completed
  const markCompleted = (device) => {
    const d = String(device || "").trim();
    if (!d) return;
    dispatch({ type: SHEETS.COMPLETE.REQUEST, payload: { device: d } });
  };

  // Navigate to /computers?id={Device}
  const goToDevice = (device) => {
    const d = String(device || "").trim();
    if (!d) return;
    navigate(`/computers?id=${encodeURIComponent(d)}`);
  };

  // Keyboard support for cards
  const onCardKey = (e, device) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToDevice(device);
    }
  };

  return (
    <Container fluid className="home-container">
      <Row>
        <Col>
          <h1 className="page-title">All Computers</h1>
        </Col>
      </Row>

      {/* Back button */}
      <Row className="mb-3">
        <Col xs={12}>
          <Button
            variant="outline-secondary"
            onClick={() => navigate("/home")}
            aria-label="Back to Home"
          >
            ← Back
          </Button>
        </Col>
      </Row>

      {/* Search */}
      <Row className="mb-3">
        <Col xs={12}>
          <InputGroup>
            <Form.Control
              type="search"
              placeholder="Search by any field (Device, Model Name, Comment, etc.)"
              value={query}
              onChange={handleSearchChange}
              aria-label="Search computers"
            />
            <Button variant="outline-secondary" disabled>
              Search
            </Button>
          </InputGroup>
          <div className="muted-text" style={{ marginTop: 6 }}>
            Tip: Matches if your text appears anywhere in any field. Leave empty to show everything.
          </div>
        </Col>
      </Row>

      {/* Loading / error */}
      {isLoading && (
        <Row className="mb-3">
          <Col xs={12}>
            <div className="loading-wrap">
              <Spinner animation="border" role="status" />
              <span className="loading-text">Loading computers…</span>
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

      {/* Results */}
      {!isLoading && !rowsError && (
        <Row className="cards-row">
          {filtered.map((obj, idx) => {
            const device = obj["Device"] || "";
            const completed = isTrue(obj["Completed"]);
            const isUpdatingThis = updatingDevice && ciEq(updatingDevice, device);
            const isClickable = device.trim().length > 0;

            return (
              <Col key={idx} xs={12} sm={12} md={6} lg={4} className="mb-3">
                <Card
                  className="device-card"
                  onClick={isClickable ? () => goToDevice(device) : undefined}
                  onKeyDown={isClickable ? (e) => onCardKey(e, device) : undefined}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  style={{
                    cursor: isClickable ? "pointer" : "default",
                    backgroundColor: completed ? "rgba(40, 167, 69, 0.10)" : undefined,
                    borderColor: completed ? "rgba(40, 167, 69, 0.35)" : undefined,
                  }}
                  aria-label={isClickable ? `Open details for ${device}` : undefined}
                >
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start">
                      <Card.Title className="device-title mb-0">
                        {device || "Device"}
                      </Card.Title>

                      {/* Show Complete button only when NOT completed */}
                      {!completed && (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            markCompleted(device);
                          }}
                          aria-label={`Mark ${device || "device"} as complete`}
                          disabled={isUpdatingThis}
                        >
                          {isUpdatingThis ? "Updating…" : "Complete"}
                        </Button>
                      )}
                    </div>

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
                      <span className="v">
                        {obj["*Model Name"] || obj["Model Name"] || "-"}
                      </span>
                    </div>

                    <div className="kv">
                      <span className="k">Comment</span>
                      <span className="v">{obj["Comment"] || "-"}</span>
                    </div>

                    <div className="kv">
                      <span className="k">Completed</span>
                      <span className="v">{completed ? "true" : "false"}</span>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}

          {filtered.length === 0 && (
            <Col xs={12}>
              <Card className="empty-card">
                <Card.Body>
                  {normalizedQuery
                    ? `No computers match "${query}".`
                    : "No computers available."}
                </Card.Body>
              </Card>
            </Col>
          )}
        </Row>
      )}
    </Container>
  );
}

export default Total;