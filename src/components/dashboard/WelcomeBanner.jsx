import './WelcomeBanner.css';

export default function WelcomeBanner({ name, role }) {
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good Morning';
    if (hr < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="welcome-banner">
      <div className="welcome-banner__content">
        <h1 className="welcome-banner__title">
          {getGreeting()}, {name}!
        </h1>
        <p className="welcome-banner__subtitle">
          Here is your business workflow and dashboard summary as an <strong>{role}</strong>.
        </p>
      </div>
      <div className="welcome-banner__illustration">
        <span className="material-icons welcome-banner__icon">analytics</span>
      </div>
    </div>
  );
}
