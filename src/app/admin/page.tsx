"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string | null;
  tokens: number;
  role: string;
  paymentStatus: string;
  createdAt: string;
}

interface Payment {
  id: string;
  userId: string;
  userEmail: string;
  package: string;
  amount: number;
  status: string;
  proofNote: string | null;
  createdAt: string;
  user: { name: string | null; tokens: number };
}

const SUPER_ADMIN_EMAIL = "ialilham77@gmail.com";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<"users" | "payments">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [tokenAmount, setTokenAmount] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");

  useEffect(() => {
    if (status === "authenticated") {
      if (session?.user?.email !== SUPER_ADMIN_EMAIL) {
        redirect("/");
      }
      fetchData();
    } else if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status, session]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, paymentsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/payments"),
      ]);
      const usersData = await usersRes.json();
      const paymentsData = await paymentsRes.json();

      if (usersData.users) setUsers(usersData.users);
      if (paymentsData.payments) setPayments(paymentsData.payments);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTokens = async (action: "add" | "set") => {
    if (!editingUser || !tokenAmount) return;

    const tokens = parseInt(tokenAmount, 10);
    if (isNaN(tokens)) {
      setMessage({ type: "error", text: "Please enter a valid number" });
      return;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUser.id,
          tokens,
          action: action === "set" ? "set" : "add",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: `Tokens updated! New balance: ${data.user.tokens}`,
        });
        setEditingUser(null);
        setTokenAmount("");
        fetchData();
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to update tokens",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error" });
    }
  };

  const handlePaymentAction = async (
    paymentId: string,
    action: "approve" | "reject"
  ) => {
    try {
      const res = await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, action }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text:
            action === "approve"
              ? `Payment approved! Added ${data.tokensAdded} tokens.`
              : "Payment rejected.",
        });
        fetchData();
      } else {
        setMessage({ type: "error", text: data.error || "Action failed" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error" });
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const pendingPayments = payments.filter((p) => p.status === "pending");

  // Filtered users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(query) ||
        (user.name?.toLowerCase() || "").includes(query)
    );
  }, [users, searchQuery]);

  // Filtered payments based on search query and status filter
  const filteredPayments = useMemo(() => {
    let result = payments;

    // Filter by status
    if (paymentStatusFilter !== "all") {
      result = result.filter((p) => p.status === paymentStatusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.userEmail.toLowerCase().includes(query) ||
          (p.user?.name?.toLowerCase() || "").includes(query)
      );
    }

    return result;
  }, [payments, searchQuery, paymentStatusFilter]);

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Admin CMS</h1>
            <p className="text-gray-500 text-sm">
              Manage users, tokens, and payments
            </p>
          </div>
          <a
            href="/"
            className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            ← Back to App
          </a>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${message.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
          >
            {message.text}
            <button
              onClick={() => setMessage(null)}
              className="ml-4 opacity-50 hover:opacity-100"
            >
              ×
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "users"
                ? "bg-white/10 text-white"
                : "text-gray-500 hover:text-white"
            }`}
          >
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === "payments"
                ? "bg-white/10 text-white"
                : "text-gray-500 hover:text-white"
            }`}
          >
            Payments
            {pendingPayments.length > 0 && (
              <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingPayments.length}
              </span>
            )}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold">{users.length}</div>
            <div className="text-sm text-gray-500">Total Users</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold">
              {users.reduce((sum, u) => sum + u.tokens, 0)}
            </div>
            <div className="text-sm text-gray-500">Total Tokens</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold text-red-400">
              {users.filter((u) => u.tokens < 100).length}
            </div>
            <div className="text-sm text-gray-500">Need Top-up</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold text-yellow-400">
              {pendingPayments.length}
            </div>
            <div className="text-sm text-gray-500">Pending Payments</div>
          </div>
        </div>

        {/* Revenue Summary */}
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-xl border border-white/10 p-6 mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            📊 Revenue Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold text-green-400">
                {formatRupiah(
                  payments
                    .filter((p) => p.status === "approved")
                    .reduce((sum, p) => sum + p.amount, 0)
                )}
              </div>
              <div className="text-sm text-gray-500">Total Revenue</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">
                {payments.filter((p) => p.status === "approved").length}
              </div>
              <div className="text-sm text-gray-500">Approved Transactions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">
                {payments
                  .filter((p) => p.status === "approved")
                  .reduce((sum, p) => sum + parseInt(p.package, 10), 0)}
              </div>
              <div className="text-sm text-gray-500">Tokens Distributed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-300">
                {payments.filter((p) => p.status === "approved").length > 0
                  ? formatRupiah(
                      payments
                        .filter((p) => p.status === "approved")
                        .reduce((sum, p) => sum + p.amount, 0) /
                        payments.filter((p) => p.status === "approved").length
                    )
                  : formatRupiah(0)}
              </div>
              <div className="text-sm text-gray-500">Avg. Payment</div>
            </div>
          </div>
        </div>

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="p-4 text-xs uppercase tracking-wider text-gray-500">
                      User
                    </th>
                    <th className="p-4 text-xs uppercase tracking-wider text-gray-500">
                      Email
                    </th>
                    <th className="p-4 text-xs uppercase tracking-wider text-gray-500">
                      Tokens
                    </th>
                    <th className="p-4 text-xs uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="p-4 text-xs uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="p-4">
                        <div className="font-medium">
                          {user.name || "No name"}
                        </div>
                        <div className="text-xs text-gray-500">{user.role}</div>
                      </td>
                      <td className="p-4 text-sm text-gray-400">
                        {user.email}
                      </td>
                      <td className="p-4">
                        <span
                          className={`font-mono font-bold ${user.tokens < 100 ? "text-red-400" : "text-green-400"}`}
                        >
                          {user.tokens}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            user.paymentStatus === "pending"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : user.paymentStatus === "active"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-white/10 text-gray-400"
                          }`}
                        >
                          {user.paymentStatus || "none"}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setTokenAmount("");
                          }}
                          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                        >
                          Edit Tokens
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search payments by email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {(["all", "pending", "approved", "rejected"] as const).map(
                  (status) => (
                    <button
                      key={status}
                      onClick={() => setPaymentStatusFilter(status)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${
                        paymentStatusFilter === status
                          ? status === "pending"
                            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                            : status === "approved"
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : status === "rejected"
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-white/10 text-white border border-white/20"
                          : "bg-white/5 text-gray-400 hover:bg-white/10"
                      }`}
                    >
                      {status}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="p-4 text-xs uppercase tracking-wider text-gray-500">
                      User
                    </th>
                    <th className="p-4 text-xs uppercase tracking-wider text-gray-500">
                      Package
                    </th>
                    <th className="p-4 text-xs uppercase tracking-wider text-gray-500">
                      Amount
                    </th>
                    <th className="p-4 text-xs uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="p-4 text-xs uppercase tracking-wider text-gray-500">
                      Date
                    </th>
                    <th className="p-4 text-xs uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">
                        {searchQuery || paymentStatusFilter !== "all"
                          ? "No payments match your filters"
                          : "No payment requests yet"}
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-white/5 hover:bg-white/5"
                      >
                        <td className="p-4">
                          <div className="font-medium">
                            {payment.user?.name || "Unknown"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {payment.userEmail}
                          </div>
                        </td>
                        <td className="p-4 font-mono font-bold text-blue-400">
                          {payment.package} tokens
                        </td>
                        <td className="p-4 text-green-400">
                          {formatRupiah(payment.amount)}
                        </td>
                        <td className="p-4">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              payment.status === "pending"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : payment.status === "approved"
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {payment.status}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-gray-500">
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          {payment.status === "pending" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handlePaymentAction(payment.id, "approve")
                                }
                                className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  handlePaymentAction(payment.id, "reject")
                                }
                                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Edit Token Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-[#121212] rounded-2xl p-6 w-full max-w-md border border-white/10">
              <h2 className="text-xl font-bold mb-4">Edit Tokens</h2>
              <p className="text-gray-400 text-sm mb-4">
                User: <strong>{editingUser.email}</strong>
                <br />
                Current Balance:{" "}
                <strong className="text-green-400">{editingUser.tokens}</strong>
              </p>

              <input
                type="number"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                placeholder="Enter token amount"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:border-blue-500"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => handleUpdateTokens("add")}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors"
                >
                  Add Tokens
                </button>
                <button
                  onClick={() => handleUpdateTokens("set")}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
                >
                  Set To
                </button>
              </div>

              <button
                onClick={() => {
                  setEditingUser(null);
                  setTokenAmount("");
                }}
                className="w-full mt-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
