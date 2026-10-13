<?php
// TEST-ONLY: mysqli look-alike over SQLite so the real PHP endpoints can run end to end.
// Keeps db.php's Origin check + exception handler semantics.
if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET','HEAD','OPTIONS'], true) && !empty($_SERVER['HTTP_ORIGIN'])) {
    $oh = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST); $op = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_PORT);
    if (strcasecmp($oh . ($op ? ':' . $op : ''), $_SERVER['HTTP_HOST'] ?? '') !== 0) { http_response_code(403); die(json_encode(['error'=>'Cross-site request blocked'])); }
}
if (!class_exists('mysqli_sql_exception', false)) {}
set_exception_handler(function ($e) {
    if (!headers_sent()) header('Content-Type: application/json');
    $code = $e instanceof mysqli_sql_exception ? (int)$e->getCode() : 0;
    if ($code === 1062) { http_response_code(409); echo json_encode(['error' => 'That record already exists']); }
    elseif ($code === 1451 || $code === 1452) { http_response_code(409); echo json_encode(['error' => 'That record is still in use by other data']); }
    elseif ($code === 4025 || $code === 3819) { http_response_code(400); echo json_encode(['error' => 'A value is outside the allowed range']); }
    else { http_response_code(500); echo json_encode(['error' => 'Something went wrong on the server', 'debug' => $e->getMessage()]); }
});
function tr($sql) {
    $sql = preg_replace('/\bFOR UPDATE\b/i', '', $sql);
    $sql = str_ireplace(['CURDATE()'], ["date('now')"], $sql);
    $sql = str_ireplace('NOW() - INTERVAL 1 DAY', "datetime('now','-1 day')", $sql);
    $sql = str_ireplace('NOW() - INTERVAL 15 MINUTE', "datetime('now','-15 minutes')", $sql);
    $sql = str_ireplace('NOW()', "datetime('now')", $sql);
    $sql = preg_replace_callback("/FIELD\(([^,]+),\s*([^)]+)\)/i", function ($m) {
        $vals = array_map('trim', explode(',', $m[2])); $c = "CASE {$m[1]}";
        foreach ($vals as $i => $v) $c .= " WHEN $v THEN " . ($i + 1);
        return $c . ' ELSE 99 END';
    }, $sql);
    if (preg_match('/ON DUPLICATE KEY UPDATE/i', $sql)) {
        if (stripos($sql, 'INTO prices') !== false)
            $sql = preg_replace('/ON DUPLICATE KEY UPDATE.*$/is', "ON CONFLICT(product_id, store_id) DO UPDATE SET price = excluded.price, last_updated = date('now')", $sql);
        else
            $sql = preg_replace('/ON DUPLICATE KEY UPDATE.*$/is', "ON CONFLICT(name) DO UPDATE SET value = excluded.value", $sql);
    }
    return $sql;
}
class ShimRes { public $num_rows = 0; private $rows; function __construct($r){ $this->rows = $r; $this->num_rows = count($r); } function fetch_assoc(){ return $this->rows ? array_shift($this->rows) : null; } }
class ShimStmt {
    public $affected_rows = 0; private $st; private $params = []; private $long = []; private $conn; private $isSelect;
    function __construct($conn, $sql){ $this->conn = $conn; $this->isSelect = preg_match('/^\s*(SELECT|WITH)/i', $sql); $this->st = $conn->pdo->prepare($sql); }
    function bind_param($types, &...$vars){ $this->params = []; foreach ($vars as &$v) $this->params[] = &$v; }
    function send_long_data($i, $d){ $this->long[$i] = $d; }
    function execute(){
        $vals = []; foreach ($this->params as $i => $v) $vals[] = $this->long[$i] ?? $v;
        try { foreach ($vals as $i => $v) { if (isset($this->long[$i])) $this->st->bindValue($i+1, $v, PDO::PARAM_LOB); else $this->st->bindValue($i+1, $v); } $this->st->execute(); }
        catch (PDOException $e) { throw $this->conn->wrap($e); }
        $this->affected_rows = $this->st->rowCount(); if (!$this->isSelect) $this->conn->insert_id = (int)$this->conn->pdo->lastInsertId(); $this->conn->affected_rows = $this->affected_rows; return true;
    }
    function get_result(){ return new ShimRes($this->st->columnCount() ? $this->st->fetchAll(PDO::FETCH_ASSOC) : []); }
}
class mysqli_sql_exception_shim {}
class ShimConn {
    public $pdo; public $insert_id = 0; public $affected_rows = 0; public $connect_error = null;
    function __construct(){ $this->pdo = new PDO('sqlite:' . getenv('SHIM_DB')); $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION); $this->pdo->exec('PRAGMA foreign_keys=ON'); }
    function wrap($e){ $m = $e->getMessage(); $code = strpos($m, 'UNIQUE') !== false ? 1062 : (strpos($m, 'FOREIGN KEY') !== false ? 1452 : (strpos($m, 'CHECK') !== false ? 4025 : 1)); return new mysqli_sql_exception($m, $code); }
    function prepare($sql){ try { return new ShimStmt($this, tr($sql)); } catch (PDOException $e) { throw $this->wrap($e); } }
    function query($sql){
        if (preg_match('/^\s*CREATE TABLE IF NOT EXISTS/i', $sql)) return true;
        $sql = tr($sql);
        try { $st = $this->pdo->query($sql); } catch (PDOException $e) { throw $this->wrap($e); }
        if ($st && $st->columnCount()) return new ShimRes($st->fetchAll(PDO::FETCH_ASSOC));
        $this->affected_rows = $st ? $st->rowCount() : 0; return true;
    }
    function begin_transaction(){ if (!$this->pdo->inTransaction()) $this->pdo->beginTransaction(); }
    function commit(){ if ($this->pdo->inTransaction()) $this->pdo->commit(); }
    function rollback(){ if ($this->pdo->inTransaction()) $this->pdo->rollBack(); }
    function set_charset($c){}
}
if (!class_exists('mysqli_sql_exception')) { class mysqli_sql_exception extends RuntimeException {} }
$conn = new ShimConn;
