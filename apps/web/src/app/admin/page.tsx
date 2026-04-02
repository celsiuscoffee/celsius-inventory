import Link from "next/link";
import { Package, Truck, Tags, Building2 } from "lucide-react";

const stats = [
  { label: "Products", value: "211", icon: Package, href: "/admin/products", color: "bg-blue-50 text-blue-600" },
  { label: "Suppliers", value: "42", icon: Truck, href: "/admin/suppliers", color: "bg-green-50 text-green-600" },
  { label: "Categories", value: "12", icon: Tags, href: "/admin/categories", color: "bg-purple-50 text-purple-600" },
  { label: "Branches", value: "4", icon: Building2, href: "/admin/branches", color: "bg-amber-50 text-amber-600" },
];

export default function AdminDashboard() {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
      <p className="mt-1 text-sm text-gray-500">Manage your inventory master data</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div className={`inline-flex rounded-lg p-2 ${stat.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
