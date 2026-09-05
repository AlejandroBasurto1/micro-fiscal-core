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

export function applyCalculatorModifier(input, modifier, ivaRate = 0.16) {
  const value = evaluateExpression(input);
  const rate = Number(ivaRate);
  if (!Number.isFinite(rate) || rate < 0) throw new Error('Tasa inválida');
  const operations = {
    addIva: () => value * (1 + rate),
    removeIva: () => value / (1 + rate),
    percent: () => value / 100,
    tip: () => value * 1.10
  };
  if (!operations[modifier]) throw new Error('Modificador inválido');
  const result = operations[modifier]();
  if (!Number.isFinite(result)) throw new Error('Resultado inválido');
  return Number(result.toFixed(modifier === 'percent' ? 4 : 2));
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
      else if (value === '+ IVA') render(applyCalculatorModifier(expression, 'addIva', ivaRate));
      else if (value === '- IVA') render(applyCalculatorModifier(expression, 'removeIva', ivaRate));
      else if (value === '%') render(applyCalculatorModifier(expression, 'percent', ivaRate));
      else if (value.includes('Propina')) render(applyCalculatorModifier(expression, 'tip', ivaRate));
      else if (value.includes('Guardar')) onSave();
      else if (!(value === '.' && /(?:^|[+\-×÷])\d*\.\d*$/.test(expression))) render(expression + value);
      const displayed = Number(display.value);
      if (Number.isFinite(displayed)) onResult(displayed);
    } catch (error) { display.value = 'ERROR'; expression = ''; }
  });
  document.addEventListener('keydown', event => {
    if (!overlay.classList.contains('active')) return;
    if (/^[0-9.+\-*/()]$/.test(event.key)) { event.preventDefault(); render(expression + event.key.replace('*','×').replace('/','÷')); }
    else if (event.key === 'Enter') { event.preventDefault(); try { calculate(); } catch { display.value='ERROR'; expression=''; } }
    else if (event.key === 'Backspace') { event.preventDefault(); render(expression.slice(0,-1)); }
  });
  return { clear: () => render(''), value: () => { const result = Number(display.value); return Number.isFinite(result) ? result : 0; } };
}
