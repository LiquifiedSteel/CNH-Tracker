// src/components/Completed.jsx
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
  Badge,
} from "react-bootstrap";
import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { SHEETS } from "../../redux/sagas/googleSheets.saga"; // adjust path if needed
import useSheetSearch from "../../hooks/useSheetSearch";
import "../Home/Home.css"; // reuse existing styles

function Completed() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // ---- Redux state ----
  const spreadsheetId = useSelector((s) => s.sheets?.spreadsheetId);
  const rows          = useSelector((s) => s.sheets?.rows);
  const isLoading     = useSelector((s) => s.sheets?.isLoading);
  const rowsError     = useSelector((s) => s.sheets?.rowsError);

  // Fetch rows if we have a linked sheet but no data yet
  useEffect(() => {
    if (spreadsheetId && (!Array.isArray(rows) || rows.length === 0)) {
      dispatch({ type: SHEETS.ROWS.REQUEST });
    }
  }, [dispatch, spreadsheetId, rows]);

  // ---- Use the reusable hook for transformation + filtering + search ----
  const { query, setQuery, filtered, normalizedQuery } = useSheetSearch(rows);

  // Treat Completed as boolean true or string "true"
  const isTrue = (v) => {
    if (typeof v === "boolean") return v;
    const s = String(v ?? "").trim().toLowerCase();
    return s === "true";
  };

  // Only show completed rows (apply on top of the hook's search result)
  const completedOnly = useMemo(
    () => filtered.filter((it) => isTrue(it["Completed"])),
    [filtered]
  );

  const completedCount = completedOnly.length;

  const handleSearchChange = (e) => setQuery(e.target.value);

  return (
    <Container fluid className="home-container">
      <Row>
        <Col>
          <h1 className="page-title">Completed Computers</h1>
        </Col>
      </Row>

      {/* Back + Counter Row */}
      <Row className="mb-3 align-items-center">
        <Col xs={6}>
          <Button
            variant="outline-secondary"
            onClick={() => navigate("/home")}
            aria-label="Back to Home"
          >
            ← Back
          </Button>
        </Col>
        <Col xs={6} className="text-end">
          <span className="muted-text me-2">Completed:</span>
          <Badge bg="success" pill>
            {completedCount}
          </Badge>
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
          {completedOnly.map((obj, idx) => (
            <Col key={idx} xs={12} sm={12} md={6} lg={4} className="mb-3">
              <Card
                className="device-card"
                style={{
                  backgroundColor: "rgba(40, 167, 69, 0.10)",  // subtle green
                  borderColor: "rgba(40, 167, 69, 0.35)",
                }}
              >
                <Card.Body>
                  <Card.Title className="device-title mb-0">
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
                    <span className="v">true</span>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}

          {completedOnly.length === 0 && (
            <Col xs={12}>
              <Card className="empty-card">
                <Card.Body>
                  {normalizedQuery
                    ? `No completed computers match "${query}".`
                    : "No completed computers."}
                </Card.Body>
              </Card>
            </Col>
          )}
        </Row>
      )}
    </Container>
  );
}

export default Completed;