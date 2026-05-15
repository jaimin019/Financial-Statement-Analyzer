import { useNavigate } from 'react-router-dom';

/**
 * BackButton — visual back navigation affordance for chat view.
 * Uses navigate(-1) to pop history (correct swipe-back behavior).
 * Falls back to /app if there's no history to pop.
 */
export default function BackButton({ label = 'Back' }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/app', { replace: true });
    }
  };

  return (
    <button
      onClick={handleClick}
      className="back-btn"
      aria-label="Go back"
    >
      <svg
        width="16" height="16" viewBox="0 0 16 16"
        fill="none" xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 3L5 8L10 13"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </button>
  );
}
