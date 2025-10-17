// src/components/Total.jsx
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
import { SHEETS } from "../../redux/sagas/googleSheets.saga"; // adjust path if needed
import useSheetSearch from "../../hooks/useSheetSearch";
import "../Home/Home.css"; // reuse existing styles

function Total() {
  const dispatch = useDispatch();

  // ---- Redux state ----
  const spreadsheetId = useSelector((s) => s.sheets?.spreadsheetId);
  const rows = useSelector((s) => s.sheets?.rows);
  const isLoading = useSelector((s) => s.sheets?.isLoading);
  const rowsError = useSelector((s) => s.sheets?.rowsError);

  // Fetch rows if we have a linked sheet but no data yet
  useEffect(() => {
    if (spreadsheetId && (!Array.isArray(rows) || rows.length === 0)) {
      dispatch({ type: SHEETS.ROWS.REQUEST });
    }
  }, [dispatch, spreadsheetId, rows]);

  // ---- Use the reusable hook for transformation + filtering + search ----
  const { query, setQuery, all, filtered, normalizedQuery } = useSheetSearch(rows);

  const handleSearchChange = (e) => setQuery(e.target.value);

  const markCompleted = (device) => {
    // TODO: wire up later
    // console.log("Mark completed:", device);
  };

  return (
    <Container fluid className="home-container">
      <Row>
        <Col>
          <h1 className="page-title">All Computers</h1>
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
          {filtered.map((obj, idx) => (
            <Col key={idx} xs={12} sm={12} md={6} lg={4} className="mb-3">
              <Card className="device-card">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start">
                    <Card.Title className="device-title mb-0">
                      {obj["Device"] || "Device"}
                    </Card.Title>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => markCompleted(obj["Device"])}
                      aria-label={`Mark ${obj["Device"] || "device"} as Completed`}
                    >
                      Completed
                    </Button>
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
                </Card.Body>
              </Card>
            </Col>
          ))}

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