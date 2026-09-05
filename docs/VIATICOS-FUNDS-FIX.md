# Viáticos — Fondo inicial y saldo disponible

Corrección de interfaz y cálculo operativo para el módulo Viáticos.

- **Anticipo / Fondo inicial**: dinero entregado antes del viaje.
- **Gastos acumulados**: suma de gasolina, casetas, estacionamiento, alimentos, hospedaje, transporte y otros gastos.
- **Saldo disponible**: `max(anticipo - gastos acumulados, 0)`.
- **Saldo por comprobar**: saldo aún pendiente de gastar/comprobar dentro del fondo disponible.
- **Reembolso requerido**: `max(gastos acumulados - anticipo, 0)`.

Casos de regresión:

- Anticipo $1,000 y gastos $350 → saldo disponible $650, reembolso $0.
- Anticipo $1,000 y gastos $1,150 → saldo disponible $0, reembolso requerido $150.

La corrección no modifica `main`, ICSSA ni las reglas fiscales/ISR.
