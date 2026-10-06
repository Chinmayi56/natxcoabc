import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import {
  ArrowLeft,
  Download,
  Printer,
  CheckCircle2,
  Circle,
} from "lucide-react";
import api from "@/lib/api";
import LoadingScreen from "@/components/shared/LoadingScreen";
import { Button } from "@/components/ui/button";
import BookServiceModal from "@/components/shared/BookServiceModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { exportPDF } from "@/lib/exports";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const WORKFLOW = [
  "Service Booked",
  "Documents Uploaded",
  "Employee Assigned",
  "CA Verification",
  "Processing",
  "GST/Tax Filing",
  "Quality Review",
  "Completed",
];

export default function ServiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [svc, setSvc] = useState(null);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Signed-in customers read the full authenticated record; anonymous
        // visitors read the public, no-login catalog so a real Admin-created
        // service (description/price/image) shows up here live instead of
        // falling straight through to the generic placeholder below.
        if (user) {
          const { data } = await api.get(`/services/${id}`);
          setSvc(data.data);
        } else {
          const { data } = await api.get(`/public/services`);
          const match = (data.data || []).find((s) => s.id === id);
          if (match) setSvc(match);
          else throw new Error("not-found-public");
        }
      } catch (e) {
        // No made-up placeholder service: an unknown/removed service is reported as not found.
        toast.error("Service not found");
        navigate("/customer/services");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate, user]);

  if (loading) return <LoadingScreen label="Loading service..." />;
  if (!svc) return null;

  const Icon = Icons[svc.icon] || Icons.FileText;
  const progress = svc.progress ?? 15;
  const currentStage = Math.floor((progress / 100) * WORKFLOW.length);

  const Info = ({ l, v }) => (
    <div className="flex justify-between py-2.5 border-b border-zinc-100">
      <span className="text-sm text-muted-foreground">{l}</span>
      <span className="text-sm font-medium text-zinc-800 text-right">
        {v || "—"}
      </span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <button
        onClick={() => navigate("/customer/services")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-zinc-900 mb-6 transition-colors"
        data-testid="back-services"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Services
      </button>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-brand-light to-brand-faint p-6 flex items-center gap-4">
          {svc.image ? (
            <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-sm shrink-0 border border-white bg-white">
              <img src={svc.image} alt={svc.title || "Service"} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-brand-hover">
              <Icon className="h-8 w-8" />
            </div>
          )}
          <div>
            <h1 className="font-heading text-2xl font-bold text-zinc-900">
              {svc.title}
            </h1>
            <p className="text-sm text-zinc-600">
              {svc.category} · {svc.price}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold"
              onClick={() => {
                if (!user) {
                  toast.info("Please sign in or create a customer account to book a service.");
                  navigate("/login", { state: { from: { pathname: `/customer/services/${id}` } } });
                  return;
                }
                setBookingOpen(true);
              }}
              data-testid="book-service-details"
            >
              Book Service
            </Button>
            <Button
              variant="outline"
              className="border-zinc-300 bg-white"
              onClick={() => window.print()}
              data-testid="print-service"
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Print
            </Button>
            <Button
              className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold"
              onClick={() =>
                exportPDF(
                  svc.title,
                  [
                    { key: "k", label: "Field" },
                    { key: "v", label: "Value" },
                  ],
                  [
                    { k: "Service", v: svc.title },
                    { k: "Status", v: svc.status },
                    { k: "Progress", v: `${progress}%` },
                    { k: "Consultant", v: svc.assigned_ca || "—" },
                  ],
                )
              }
              data-testid="pdf-service"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Download PDF
            </Button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="font-heading text-base font-semibold text-zinc-900 mb-3">
              Service Overview
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {svc.description}
            </p>
            <Info l="Status" v={<StatusBadge value={svc.status} />} />
            <Info l="Assigned Chartered Accountant" v={svc.assigned_ca} />
            <Info l="Assigned Employee" v={svc.assigned_employee} />
            <Info l="GST Number" v="29ABCDE1234F1Z5" />
            <Info l="PAN Number" v="ABCDE1234F" />
            <Info l="Expected Completion" v={svc.expected_completion} />
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-zinc-700">
                  Progress
                </span>
                <span className="text-sm font-semibold text-zinc-900">
                  {progress}%
                </span>
              </div>
              <Progress
                value={progress}
                className="h-2.5 bg-zinc-100 [&>div]:bg-brand"
              />
            </div>
          </div>

          <div>
            <h3 className="font-heading text-base font-semibold text-zinc-900 mb-4">
              Project Timeline
            </h3>
            <div className="space-y-0">
              {WORKFLOW.map((stage, i) => {
                const done = i < currentStage;
                const active = i === currentStage;
                return (
                  <motion.div
                    key={stage}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex gap-3"
                  >
                    <div className="flex flex-col items-center">
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-brand-hover" />
                      ) : (
                        <Circle
                          className={`h-5 w-5 ${active ? "text-brand fill-brand-light" : "text-zinc-300"}`}
                        />
                      )}
                      {i < WORKFLOW.length - 1 && (
                        <div
                          className={`w-px flex-1 min-h-[24px] ${done ? "bg-brand" : "bg-zinc-200"}`}
                        />
                      )}
                    </div>
                    <div className="pb-4">
                      <p
                        className={`text-sm font-medium ${done || active ? "text-zinc-900" : "text-zinc-400"}`}
                      >
                        {stage}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {done
                          ? "Completed"
                          : active
                            ? "In progress"
                            : "Pending"}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {user && <BookServiceModal open={bookingOpen} onOpenChange={setBookingOpen} preselectService={{ id: svc.id, title: svc.title || svc.name }} />}
    </div>
  );
}
