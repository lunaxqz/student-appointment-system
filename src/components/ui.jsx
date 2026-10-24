export const Badge = ({ s }) => <span className={'badge badge-' + s}>{s}</span>;
export const Field = ({ l, children }) => (<div><label>{l}</label>{children}</div>);
