import React, { useEffect, useState } from 'react';
import { api } from '../api';
import type { OrderRequest, RiskCheck } from '../types';

interface Props {
  order: OrderRequest;
  lastPrice: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RiskGate({ order, lastPrice, onConfirm, onCancel }: Props): React.ReactElement {
  const [riskCheck, setRiskCheck] = useState<RiskCheck | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.validateOrder(order, lastPrice)
      .then(result => { if (mounted) { setRiskCheck(result); setLoading(false); } })
      .catch(() => {
        if (mounted) {
          // On error, allow the order through (fail-open for paper trading)
          setRiskCheck({ allowed: true, warnings: ['Risk check unavailable'], errors: [] });
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [order, lastPrice]);

  if (loading) {
    return (
      <div className="risk-gate">
        <p>Checking risk limits...</p>
      </div>
    );
  }

  if (!riskCheck) return <></>;

  return (
    <div className="risk-gate">
      {riskCheck.errors.length > 0 && (
        <div className="risk-gate-errors">
          {riskCheck.errors.map((err, i) => (
            <div key={i} className="risk-gate-error">{err}</div>
          ))}
        </div>
      )}

      {riskCheck.warnings.length > 0 && (
        <div className="risk-gate-warnings">
          {riskCheck.warnings.map((warn, i) => (
            <div key={i} className="risk-gate-warning">{warn}</div>
          ))}
        </div>
      )}

      {riskCheck.suggestedQty !== undefined && riskCheck.suggestedQty > 0 && (
        <div className="risk-gate-suggestion">
          Suggested quantity: {riskCheck.suggestedQty} shares
        </div>
      )}

      {riskCheck.allowed && riskCheck.errors.length === 0 && riskCheck.warnings.length === 0 && (
        <div className="risk-gate-ok">Order passes all risk checks</div>
      )}

      <div className="risk-gate-actions">
        <button className="btn btn-secondary" onClick={onCancel}>Go Back</button>
        {riskCheck.allowed && (
          <button className="btn btn-primary" onClick={onConfirm}>Confirm Order</button>
        )}
      </div>
    </div>
  );
}
