import { useAuth } from "../state/auth";

const Profile = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Profile</h1>
        <p className="text-slate mt-2">Account details and security settings.</p>
      </div>

      <div className="data-card p-6 space-y-3">
        <div>
          <p className="text-sm text-slate">Email</p>
          <p className="font-semibold text-ink">{user?.email}</p>
        </div>
        <div>
          <p className="text-sm text-slate">Password</p>
          <p className="text-ink">Change password (coming soon)</p>
        </div>
      </div>
    </div>
  );
};

export default Profile;
