export type Severity = 'warning' | 'error';

export interface Diagnostic {
  severity: Severity;
  message: string;
  /** 1-based line in the source document, when known */
  line?: number;
  /** source offset for scroll-to-location */
  srcStart?: number;
  code?: string;
}

export type Indicator = 'green' | 'orange' | 'red';

export function indicatorFor(diags: Diagnostic[]): Indicator {
  if (diags.some((d) => d.severity === 'error')) return 'red';
  if (diags.length > 0) return 'orange';
  return 'green';
}
