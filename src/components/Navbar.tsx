import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  function onLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <Link to="/" className="brand">
        RecipeShare
      </Link>
      <nav>
        <NavLink to="/" end>
          Gallery
        </NavLink>
        <NavLink to="/add">Add recipe</NavLink>
        <NavLink to="/mine">My recipes</NavLink>
      </nav>
      <div className="user-area">
        <span className="user-email">{user.email}</span>
        {user.role === 'admin' && <span className="badge badge-admin">admin</span>}
        <button className="link-button" onClick={onLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}
