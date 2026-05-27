import { useNavigate } from "react-router-dom";

export function BackButton({ to, label = "Назад", fallback = "/" }) {
  const navigate = useNavigate();

  function handleClick() {
    if (to) {
      navigate(to);
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallback);
  }

  return (
    <button type="button" className="app-back" onClick={handleClick}>
      <span className="app-back__icon" aria-hidden="true">
        ‹
      </span>
      <span>{label}</span>
    </button>
  );
}
