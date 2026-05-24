import { Link } from "react-router-dom";

export function Breadcrumbs({ items = [] }) {
  if (!Array.isArray(items) || items.length <= 1) {
    return null;
  }

  return (
    <nav className="app-breadcrumbs" aria-label="Хлебные крошки">
      <ol>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {item.to && !isLast ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
