import { useAuth } from '../contexts/AuthContext'

const Dashboard = () => {
  const { user } = useAuth()

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">Dashboard</h1>

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4 text-blue-600">
          Welcome, {user?.username}!
        </h2>
        <p className="text-gray-600 mb-4">
          This is your dashboard. You can add your application-specific content here.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="font-bold text-lg mb-2">User Information</h3>
            <p><strong>Username:</strong> {user?.username}</p>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Name:</strong> {user?.first_name} {user?.last_name}</p>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <h3 className="font-bold text-lg mb-2">Account Status</h3>
            <p><strong>Status:</strong> Active</p>
            <p><strong>Member since:</strong> {new Date(user?.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Quick Actions</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <button className="bg-blue-500 text-white py-3 px-6 rounded-lg hover:bg-blue-600">
            Action 1
          </button>
          <button className="bg-green-500 text-white py-3 px-6 rounded-lg hover:bg-green-600">
            Action 2
          </button>
          <button className="bg-purple-500 text-white py-3 px-6 rounded-lg hover:bg-purple-600">
            Action 3
          </button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
