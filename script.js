// --- グローバル変数 ---
const tableBody = document.querySelector("#input-table tbody");
const estimationInfo = document.getElementById('estimation-info');
const resultPlain = document.getElementById('result-plain');
const resultLatex = document.getElementById('result-latex');
const resultDesmos = document.getElementById('result-desmos');
const csvFileInput = document.getElementById('csv-file-input');
let outputMode = 'fraction';
let lastCalculatedCoefficients = null;

// --- 初期化 & イベントリスナー ---
window.onload = function() { addRow(); addRow(); updateEstimation(); };
csvFileInput.addEventListener('change', handleFileSelect);

// --- 表示形式設定 ---
function setOutputFormat() {
    outputMode = document.querySelector('input[name="output-format"]:checked').value;
    if (lastCalculatedCoefficients) {
        displayResult(lastCalculatedCoefficients);
    }
}

// --- Fractionクラス (変更なし) ---
function gcd(a, b) { return b === 0 ? a : gcd(b, Math.round(a % b)); }
class Fraction {
    constructor(value, denominator = 1) {
        if (denominator === 0) { throw new Error("Denominator cannot be zero."); }
        let numerator;
        if (typeof value === 'string') {
            if (value.includes('/')) {
                const parts = value.split('/');
                numerator = parseInt(parts[0], 10);
                denominator = parseInt(parts[1], 10);
                if (isNaN(numerator) || isNaN(denominator)) { throw new Error(`Invalid fraction format: ${value}`); }
            } else {
                numerator = parseFloat(value);
                if (isNaN(numerator)) { throw new Error(`Invalid number format: ${value}`); }
            }
        } else { numerator = value; }
        if (!Number.isInteger(numerator)) {
            const numStr = numerator.toString();
            if (numStr.includes('.')) {
                const decimalPlaces = numStr.split('.')[1].length;
                const multiplier = Math.pow(10, decimalPlaces);
                numerator = Math.round(numerator * multiplier);
                denominator *= multiplier;
            }
        }
        this.num = numerator; this.den = denominator; this.reduce();
    }
    reduce() { const common = gcd(Math.abs(this.num), Math.abs(this.den)); this.num = Math.round(this.num / common); this.den = Math.round(this.den / common); if (this.den < 0) { this.num = -this.num; this.den = -this.den; } }
    add(other) { return new Fraction(this.num * other.den + other.num * this.den, this.den * other.den); }
    subtract(other) { return new Fraction(this.num * other.den - other.num * this.den, this.den * other.den); }
    multiply(other) { return new Fraction(this.num * other.num, this.den * other.den); }
    divide(other) { if (other.isZero()) { throw new Error("Cannot divide by zero fraction."); } return new Fraction(this.num * other.den, this.den * other.num); }
    isZero() { return this.num === 0; }
    power(exp) { if (!Number.isInteger(exp) || exp < 0) { throw new Error("Exponent must be a non-negative integer."); } if (exp === 0) return new Fraction(1); const newNum = this.num ** exp; const newDen = this.den ** exp; return new Fraction(newNum, newDen); }
}

// --- 行列計算 (変更なし) ---
function gaussJordanEliminationWithFractions(A) {
    const N = A.length;
    for (let i = 0; i < N; i++) {
        let maxRow = i;
        for (let k = i + 1; k < N; k++) { if (Math.abs(A[k][i].num / A[k][i].den) > Math.abs(A[maxRow][i].num / A[maxRow][i].den)) { maxRow = k; } }
        [A[i], A[maxRow]] = [A[maxRow], A[i]];
        const pivot = A[i][i];
        if (pivot.isZero()) { return null; }
        for (let j = i; j < N + 1; j++) { A[i][j] = A[i][j].divide(pivot); }
        for (let k = 0; k < N; k++) {
            if (k !== i) {
                const factor = A[k][i];
                for (let j = i; j < N + 1; j++) { A[k][j] = A[k][j].subtract(factor.multiply(A[i][j])); }
            }
        }
    }
    return A.map(row => row[N]);
}

// --- メイン処理 ---
function calculate() {
    // ★★★ 計算前に結果表示エリアをクリア ★★★
    resultPlain.textContent = "計算中...";
    resultLatex.textContent = "";
    resultDesmos.textContent = "";
    lastCalculatedCoefficients = null;

    const points = getPoints();
    if (points.length < 2) { displayError("少なくとも2つの点を入力してください。"); return; }
    
    try {
        const augmentedMatrix = [];
        for (let i = 0; i < points.length; i++) {
            const [x_str, y_str] = points[i];
            const x_frac = new Fraction(x_str);
            const y_frac = new Fraction(y_str);
            const row = [];
            for (let j = 0; j < points.length; j++) { row.push(x_frac.power(j)); }
            row.push(y_frac);
            augmentedMatrix.push(row);
        }
        
        setTimeout(() => {
            const coefficients = gaussJordanEliminationWithFractions(augmentedMatrix);
            lastCalculatedCoefficients = coefficients;
            displayResult(coefficients);
        }, 50);

    } catch (error) { displayError("計算中にエラーが発生しました: " + error.message); }
}

// --- 結果表示 (変更なし) ---
function displayResult(coefficients) {
    if (!coefficients) { displayError("計算できませんでした。入力値を確認してください。"); return; }
    let plainTerms = [], latexTerms = [], desmosTerms = [];
    for (let i = coefficients.length - 1; i >= 0; i--) {
        const coeff = coefficients[i];
        if (coeff.isZero()) continue;
        const sign = coeff.num >= 0 ? "+" : "-";
        let coeffStrPlain = "", coeffStrLatex = "", coeffStrDesmos = "";
        if (outputMode === 'fraction') {
            const absNum = Math.abs(coeff.num); const den = coeff.den;
            if (den === 1) { coeffStrPlain = coeffStrLatex = coeffStrDesmos = absNum.toString(); }
            else { coeffStrPlain = `${absNum}/${den}`; coeffStrLatex = `\\frac{${absNum}}{${den}}`; coeffStrDesmos = `(${absNum}/${den})`; }
        } else {
            const decimalValue = Math.abs(coeff.num / coeff.den);
            coeffStrPlain = coeffStrLatex = coeffStrDesmos = decimalValue.toFixed(6);
        }
        const isCoeffOne = Math.abs((coeff.num / coeff.den) - 1) < 1e-9;
        let plainTerm = "", latexTerm = "", desmosTerm = "";
        if (i === 0) { plainTerm = coeffStrPlain; latexTerm = coeffStrLatex; desmosTerm = coeffStrDesmos; }
        else if (i === 1) { plainTerm = isCoeffOne ? "x" : `${coeffStrPlain}x`; latexTerm = isCoeffOne ? "x" : `${coeffStrLatex}x`; desmosTerm = isCoeffOne ? "x" : `${coeffStrDesmos}*x`; }
        else { plainTerm = isCoeffOne ? `x${toSuperscript(i)}` : `${coeffStrPlain}x${toSuperscript(i)}`; latexTerm = isCoeffOne ? `x^{${i}}` : `${coeffStrLatex}x^{${i}}`; desmosTerm = isCoeffOne ? `x^${i}` : `${coeffStrDesmos}*x^${i}`; }
        plainTerms.push({ sign, term: plainTerm }); latexTerms.push({ sign, term: latexTerm }); desmosTerms.push({ sign, term: desmosTerm });
    }
    resultPlain.textContent = buildEquationString(plainTerms, "y =");
    resultLatex.textContent = buildEquationString(latexTerms, "y =");
    resultDesmos.textContent = buildEquationString(desmosTerms, "y =");
}

// --- ヘルパー関数群 ---
function getPoints() { const points = []; document.querySelectorAll("#input-table tbody tr").forEach(row => { const xInput = row.querySelector('.x-value'); const yInput = row.querySelector('.y-value'); if (xInput.value.trim() !== '' && yInput.value.trim() !== '') { points.push([xInput.value.trim(), yInput.value.trim()]); } }); return points; }

// ★★★ placeholderを削除 ★★★
function addRowWithValue(x, y) {
    const newRow = tableBody.insertRow();
    newRow.innerHTML = `<td><input type="text" class="x-value" value="${x}" oninput="updateEstimation()" /></td><td><input type="text" class="y-value" value="${y}" oninput="updateEstimation()" /></td><td><button class="delete-btn" onclick="deleteRow(this)">削除</button></td>`;
}
function addRow() { addRowWithValue('', ''); updateEstimation(); }
function deleteRow(button) { button.closest('tr').remove(); updateEstimation(); }
function getRowCount() { return document.querySelectorAll("#input-table tbody tr").length; }
function updateEstimation() { const N = getRowCount(); let message = ""; if (N > 0) { if (N <= 3) message = "瞬時 (処理量: 最小)"; else if (N <= 8) message = "数秒かかる可能性があります (処理量: 小)"; else if (N <= 12) message = "十数秒以上かかる可能性があります (処理量: 中)"; else message = "【高精度計算】非常に長い時間がかかります (処理量: 大)"; estimationInfo.textContent = `入力点: ${N}個 | おおよその計算時間: ${message}`; } else { estimationInfo.textContent = ""; } }
function copyToClipboard(elementId, button) { const text = document.getElementById(elementId).textContent; if(!text) return; navigator.clipboard.writeText(text).then(() => { const originalText = button.textContent; button.textContent = 'コピー完了'; setTimeout(() => { button.textContent = originalText; }, 1500); }).catch(err => console.error('コピーに失敗しました', err)); }
function toSuperscript(num) { const superscriptDigits = {'0': '⁰','1': '¹','2': '²', '3': '³','4': '⁴','5': '⁵','6': '⁶','7': '⁷','8': '⁸','9': '⁹'}; return String(num).split('').map(digit => superscriptDigits[digit]).join(''); }
function handleFileSelect(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => parseCSVAndPopulateTable(e.target.result); reader.readAsText(file); event.target.value = ''; }
function parseCSVAndPopulateTable(csvText) { tableBody.innerHTML = ''; const lines = csvText.split(/\r\n|\n/); let addedCount = 0; lines.forEach(line => { line = line.trim(); if (line === '') return; const values = line.split(','); if (values.length !== 2) return; addRowWithValue(values[0].trim(), values[1].trim()); addedCount++; }); if (addedCount === 0) { alert("有効なデータが見つかりませんでした。"); addRow(); addRow(); } updateEstimation(); }
function displayError(message) { resultPlain.textContent = message; resultLatex.textContent = ""; resultDesmos.textContent = ""; }
function buildEquationString(terms, prefix) { if (terms.length === 0) return ``; let equation = `${prefix} `; if (terms[0].sign === "-") equation += "-"; equation += terms[0].term; for (let i = 1; i < terms.length; i++) { equation += ` ${terms[i].sign} ${terms[i].term}`; } return equation; }