"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// Configuration - can be moved to env or DB later
const BANK_INFO = {
  name: "Bank Jago",
  accountNumber: "501625105308",
  accountHolder: "Ilham Almalik",
};

const WHATSAPP_NUMBER = "62895639359516"; // Replace with your number

const TOKEN_PACKAGES = [
  { id: "starter", tokens: 500, price: 50000, popular: false },
  { id: "pro", tokens: 1000, price: 90000, popular: true },
  { id: "business", tokens: 5000, price: 400000, popular: false },
];

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedPackage, setSelectedPackage] = useState<
    (typeof TOKEN_PACKAGES)[0] | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userTokens, setUserTokens] = useState<number | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const res = await fetch("/api/user/tokens");
        const data = await res.json();
        setUserTokens(data.tokens);
      } catch (e) {
        console.error(e);
      }
    };
    if (status === "authenticated") fetchTokens();
  }, [status]);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const generateWhatsAppLink = (pkg: (typeof TOKEN_PACKAGES)[0]) => {
    const message = encodeURIComponent(
      `Halo Admin,\n\n` +
        `Saya sudah transfer untuk pembelian token:\n\n` +
        `📦 Paket: ${pkg.tokens} Tokens\n` +
        `💰 Jumlah: ${formatRupiah(pkg.price)}\n` +
        `📧 Email: ${session?.user?.email}\n` +
        `📅 Tanggal: ${new Date().toLocaleDateString("id-ID")}\n\n` +
        `Bukti transfer terlampir. Mohon diproses. Terima kasih! 🙏`
    );
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
  };

  const handleConfirmPayment = async (pkg: (typeof TOKEN_PACKAGES)[0]) => {
    setSelectedPackage(pkg);
  };

  const handleWhatsAppConfirm = async () => {
    if (!selectedPackage) return;
    setIsSubmitting(true);

    try {
      // Save payment request to database
      await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package: String(selectedPackage.tokens),
          amount: selectedPackage.price,
          proofNote: `WhatsApp confirmation sent on ${new Date().toLocaleDateString("id-ID")}`,
        }),
      });

      // Open WhatsApp link
      window.open(generateWhatsAppLink(selectedPackage), "_blank");

      // Close modal and show success
      setSelectedPackage(null);
    } catch (error) {
      console.error("Failed to save payment request:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#080808]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to App
          </a>
          <div className="text-sm text-gray-400">
            Current Balance:{" "}
            <span
              className={
                userTokens !== null && userTokens < 100
                  ? "text-red-400"
                  : "text-green-400"
              }
            >
              {userTokens ?? "..."} tokens
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-3">Get More Tokens</h1>
          <p className="text-gray-400">
            Choose a package and start building more projects
          </p>
        </div>

        {/* Packages Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {TOKEN_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative bg-[#0c0c0c] rounded-2xl border p-6 transition-all hover:scale-[1.02] cursor-pointer ${
                pkg.popular
                  ? "border-blue-500 shadow-lg shadow-blue-500/20"
                  : "border-white/10 hover:border-white/20"
              }`}
              onClick={() => handleConfirmPayment(pkg)}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  POPULAR
                </div>
              )}
              <div className="text-center">
                <div className="text-4xl font-bold mb-1">
                  {pkg.tokens.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm mb-4">tokens</div>
                <div className="text-2xl font-bold text-green-400 mb-6">
                  {formatRupiah(pkg.price)}
                </div>
                <button
                  className={`w-full py-3 rounded-xl font-medium transition-colors ${
                    pkg.popular
                      ? "bg-blue-600 hover:bg-blue-500 text-white"
                      : "bg-white/10 hover:bg-white/20 text-white"
                  }`}
                >
                  Select Package
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Payment Instructions */}
        <div className="bg-[#0c0c0c] rounded-2xl border border-white/10 p-8">
          <h2 className="text-xl font-bold mb-6">How to Top Up</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold shrink-0">
                1
              </div>
              <div>
                <div className="font-medium mb-1">
                  Transfer to our bank account
                </div>
                <div className="bg-[#1a1a1a] rounded-xl p-4 mt-3 text-sm">
                  <div className="flex justify-between gap-4 mb-2">
                    <span className="text-gray-400">Bank</span>
                    <span className="font-mono">{BANK_INFO.name}</span>
                  </div>
                  <div className="flex justify-between gap-4 mb-2">
                    <span className="text-gray-400">Account Number</span>
                    <span className="font-mono">{BANK_INFO.accountNumber}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400">Account Holder</span>
                    <span className="font-mono">{BANK_INFO.accountHolder}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold shrink-0">
                2
              </div>
              <div>
                <div className="font-medium mb-1">
                  Send confirmation via WhatsApp
                </div>
                <p className="text-gray-400 text-sm">
                  Click the button below after transfer to send us your payment
                  confirmation with proof.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold shrink-0">
                3
              </div>
              <div>
                <div className="font-medium mb-1">
                  Tokens added within 24 hours
                </div>
                <p className="text-gray-400 text-sm">
                  We'll verify your payment and add tokens to your account.
                  You'll be notified once done!
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Selected Package Modal */}
      {selectedPackage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#121212] rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h2 className="text-xl font-bold mb-4">Confirm Purchase</h2>

            <div className="bg-[#1a1a1a] rounded-xl p-4 mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Package</span>
                <span className="font-bold">
                  {selectedPackage.tokens.toLocaleString()} Tokens
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Amount</span>
                <span className="font-bold text-green-400">
                  {formatRupiah(selectedPackage.price)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Your Email</span>
                <span className="text-sm">{session?.user?.email}</span>
              </div>
            </div>

            <button
              onClick={handleWhatsAppConfirm}
              disabled={isSubmitting}
              className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors flex items-center justify-center gap-2 mb-3"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              )}
              {isSubmitting ? "Processing..." : "Confirm via WhatsApp"}
            </button>

            <button
              onClick={() => setSelectedPackage(null)}
              className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
