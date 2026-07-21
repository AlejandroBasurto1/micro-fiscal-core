const operators = { '+': { p: 1, fn: (a,b) => a+b }, '-': { p: 1, fn: (a,b) => a-b }, '*': { p: 2, fn: (a,b) => a*b }, '/': { p: 2, fn: (a,b) => a/b } };

export function evaluateExpression(input) {
  const expression = String(input).replace(/×/g, '*').replace(/÷/g, '/').replace(/\s/g, '');
  if (!expression || !/^[0-9.+\-*/()]+$/.test(expression)) throw new Error('Expresión inválida');
  const tokens = expression.match(/\d*\.\d+|\d+|[()+\-*/]/g);
  if (!tokens || tokens.join('') !== expression) throw new Error('Expresión inválida');
  const output = [], stack = [];
  tokens.forEach(token => {
    if (/^\d/.test(token) || token.startsWith('.')) output.push(Number(token));
    else if (operators[token]) { while (operators[stack.at(-1)]?.p >= operators[token].p) output.push(stack.pop()); stack.push(token); }
    else if (token === '(') stack.push(token);
    else if (token === ')') { while (stack.length && stack.at(-1) !== '(') output.push(stack.pop()); if (stack.pop() !== '(') throw new Error('Paréntesis inválidos'); }
  });
  while (stack.length) { const token = stack.pop(); if (token === '(') throw new Error('Paréntesis inválidos'); output.push(token); }
  const values = [];
  output.forEach(token => {
    if (typeof token === 'number') values.push(token);
    else { const b = values.pop(), a = values.pop(); if (!Number.isFinite(a) || !Number.isFinite(b) || (token === '/' && b === 0)) throw new Error('Operación inválida'); values.push(operators[token].fn(a,b)); }
  });
  if (values.length !== 1 || !Number.isFinite(values[0])) throw new Error('Resultado inválido');
  return Number(values[0].toFixed(8));
}

export function bindCalculator({ overlay, display, onSave, onResult, ivaRate }) {
  let expression = '';
  const render = value => { expression = String(value ?? ''); display.value = expression; };
  const calculate = () => { const result = evaluateExpression(expression); render(result); onResult(result); return result; };
  overlay.querySelector('#calcGrid').addEventListener('click', event => {
    const key = event.target.closest('.calc-key'); if (!key) return;
    const value = key.textContent.trim();
    try {
      if (value === 'C') render('');
      else if (value === '=') calculate();
      else if (value === '+ IVA') render((evaluateExpression(expression) * (1 + ivaRate)).toFixed(2));
      else if (value === '- IVA') render((evaluateExpression(expression) / (1 + ivaRate)).toFixed(2));
      else if (value === '%') render((evaluateExpression(expression) / 100).toFixed(4));
      else if (value.includes('Propina')) render((evaluateExpression(expression) * 1.10).toFixed(2));
      else if (value.includes('Guardar')) onSave();
      else if (!(value === '.' && /(?:^|[+\-×÷])\d*\.\d*$/.test(expression))) render(expression + value);
      onResult(Number(display.value) || 0);
    } catch (error) { display.value = 'ERROR'; expression = ''; }
  });
  document.addEventListener('keydown', event => {
    if (!overlay.classList.contains('active')) return;
    if (/^[0-9.+\-*/()]$/.test(event.key)) { event.preventDefault(); render(expression + event.key.replace('*','×').replace('/','÷')); }
    else if (event.key === 'Enter') { event.preventDefault(); try { calculate(); } catch { display.value='ERROR'; expression=''; } }
    else if (event.key === 'Backspace') { event.preventDefault(); render(expression.slice(0,-1)); }
  });
  return { clear: () => render(''), value: () => Number(display.value) || 0 };
}
