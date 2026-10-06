import { useNavigate } from "react-router-dom";
import { ShieldCheck, Users, UserRound, Briefcase } from "lucide-react";

export default function PortalSelectionPage() {
  const navigate = useNavigate();

  const portals = [
    {
      title: "Super Admin",
      description: "Manage Employees, Customers, Projects & Reports",
      icon: <ShieldCheck size={42} />,
      route: "/admin/dashboard",
    },
    {
      title: "Employee",
      description: "Attendance, Tasks, Payroll & Performance",
      icon: <Users size={42} />,
      route: "/employee/dashboard",
    },
    {
      title: "Customer",
      description: "Services, Invoices, Payments & Documents",
      icon: <UserRound size={42} />,
      route: "/customer/dashboard",
    },
    {
      title: "Agent",
      description: "Leads, Bookings & Commission",
      icon: <Briefcase size={42} />,
      route: "/agent/dashboard",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-blue-50 flex items-center justify-center p-8">
      <div className="max-w-6xl w-full">

        {/* Header */}
        <div className="text-center mb-12">
          {/* Replace with your logo if available */}
          <img
            src="/logo.png"
            alt="TaxCo ERP"
            className="h-28 w-auto mx-auto mb-6"
            onError={(e) => (e.target.style.display = "none")}
          />

          <h1 className="text-5xl font-extrabold text-gray-900">
            NTAXCO ERP
          </h1>

          <p className="text-gray-600 text-xl mt-3">
            Enterprise Tax Management System
          </p>

          <p className="text-lg text-gray-500 mt-2">
            Select Your Workspace
          </p>
        </div>

        {/* Portal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {portals.map((portal) => (
            <div
              key={portal.title}
              onClick={() => navigate(portal.route)}
              className="cursor-pointer rounded-3xl border border-yellow-300 bg-white shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 p-8"
            >
              <div className="text-yellow-500 mb-5">
                {portal.icon}
              </div>

              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                {portal.title}
              </h2>

              <p className="text-gray-600 mb-8">
                {portal.description}
              </p>

              <button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 rounded-xl transition">
                Enter Workspace
              </button>
            </div>
          ))}

        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500">
          © 2026 TaxCo ERP • Enterprise Management System
        </div>

      </div>
    </div>
  );
}