
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  Upload,
  X,
  FileText,
  ChevronRight,
  ChevronLeft,
  Download,
  LayoutDashboard,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { exportPDF } from "@/lib/exports";
import { inr } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STEPS = ["Details", "Schedule & Docs", "Review"];

/* ---------------------------------------------------------
   Convert service price into a numeric amount.
   Examples:
   "From ₹1,499" -> 1499
   "₹1,999"       -> 1999
   "Contact us"   -> 0
--------------------------------------------------------- */
function getServicePrice(service) {
  if (!service) {
    return 0;
  }

  const rawPrice = service.price;

  if (typeof rawPrice === "number") {
    return Number.isFinite(rawPrice) ? rawPrice : 0;
  }

  const text = String(rawPrice || "").replace(/,/g, "");

  const match = text.match(/[\d]+(?:\.\d+)?/);

  if (!match) {
    return 0;
  }

  const value = Number(match[0]);

  return Number.isFinite(value) ? value : 0;
}

/* ---------------------------------------------------------
   Normalize backend service data.
--------------------------------------------------------- */
function normalizeService(service, index) {
  const title = String(
    service?.title || service?.name || service?.service_name || ""
  ).trim();

  if (!title) {
    return null;
  }

  return {
    id: service?.id ? String(service.id) : "",
    title,
    name: title,
    category: service?.category || "Other",
    description: service?.description || "",
    price:
      service?.price !== undefined && service?.price !== null
        ? service.price
        : "Contact us",
    icon: service?.icon || "FileText",
    status: service?.status || "Active",
    image: service?.image || "",
  };
}

export default function BookServiceModal({
  open,
  onOpenChange,
  preselectService,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [codOpen, setCodOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [services, setServices] = useState([]);
  const [agents, setAgents] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState(null);
  // One id per booking attempt: a retry/double-click of the SAME attempt is
  // de-duplicated by the backend, while a genuinely new booking gets a new id.
  const requestIdRef = useRef(null);

  const [form, setForm] = useState({
    customer_name: user?.name || "",
    company: user?.name || "",
    email: user?.email || "",
    mobile: user?.mobile || "",
    gst: "",
    pan: "",
    business_type: "",
    city: "",
    state: "",
    pincode: "",
    service:
      typeof preselectService === "object"
        ? preselectService?.title || preselectService?.name || ""
        : preselectService || "",
    project_name: "",
    description: "",
    project_value: "",
    turnover: "",
    start_date: "",
    completion_date: "",
    urgency: "Normal",
    appt_date: "",
    appt_time: "11:00 AM",
    mode: "Google Meet",
    notes: "",
    accurate: false,
    terms: false,
  });

  /* -------------------------------------------------------
     Load services and agents.
     
     IMPORTANT:
     Services are loaded independently from agents.
     /agents is admin-only and can return 403 for customers.
     That must NOT prevent the service dropdown from working.
  ------------------------------------------------------- */
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let active = true;

    setServicesLoading(true);
    setServicesError(false);

    const loadServices = async () => {
      try {
        const response = await api.get("/services");

        if (!active) {
          return;
        }

        const backendServices = Array.isArray(response.data?.data)
          ? response.data.data
              .map(normalizeService)
              .filter(Boolean)
              // Only services that exist in MongoDB can be booked.
              .map((service) => ({ ...service, live: Boolean(service.id) }))
          : [];

        // Only services that really exist in MongoDB (and are bookable) are offered.
        // No hardcoded/mock catalogue is merged in: every selectable service has a real id,
        // so the booking, payment, Admin customer record and Task Board all see the same service.
        setServices(
          backendServices.filter(
            (service) =>
              !["inactive", "archived", "hidden", "disabled"].includes(
                String(service.status || "active").trim().toLowerCase()
              )
          )
        );
      } catch (error) {
        if (!active) {
          return;
        }

        // Never substitute made-up services when the live catalogue cannot be loaded.
        setServices([]);
        setServicesError(true);

        console.error("SERVICE CATALOGUE ERROR:", error);

        toast.error(
          "Unable to load services right now. Please check your connection and try again."
        );
      } finally {
        if (active) {
          setServicesLoading(false);
        }
      }
    };

    const loadAgents = async () => {
      try {
        const response = await api.get("/agents");

        if (!active) {
          return;
        }

        setAgents(
          Array.isArray(response.data?.data)
            ? response.data.data
            : []
        );
      } catch (error) {
        /*
         * Customers are not expected to access /agents.
         * This is intentionally non-fatal.
         */
        if (active) {
          setAgents([]);
        }
      }
    };

    loadServices();
    loadAgents();

    return () => {
      active = false;
    };
  }, [open]);

  /* -------------------------------------------------------
     Keep form data synchronized with logged-in customer and
     preselected service.
  ------------------------------------------------------- */
  useEffect(() => {
    if (!open) {
      return;
    }

    setForm((previous) => ({
      ...previous,
      customer_name: previous.customer_name || user?.name || "",
      company: previous.company || user?.name || "",
      email: previous.email || user?.email || "",
      mobile: previous.mobile || user?.mobile || "",
      service:
      typeof preselectService === "object"
        ? preselectService?.title || preselectService?.name || ""
        : preselectService || previous.service || "",
    }));
  }, [open, user, preselectService]);

  const set = (key, value) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  /* -------------------------------------------------------
     Find selected service.
  ------------------------------------------------------- */
  const selectedService = useMemo(() => {
    if (!form.service) {
      return null;
    }

    const wantedTitle = String(form.service).trim().toLowerCase();
    const titleOf = (service) =>
      String(service?.title || service?.name || "").trim().toLowerCase();

    // The id handed over from the Services page / Service Details page is only used while the
    // dropdown still shows that same service. If the customer then switches the dropdown to a
    // different service, the dropdown wins — otherwise the wrong service would be booked.
    const preselectedId =
      preselectService && typeof preselectService === "object"
        ? String(preselectService.id || "").trim()
        : "";
    const preselectedTitle =
      preselectService && typeof preselectService === "object"
        ? String(preselectService.title || preselectService.name || "").trim().toLowerCase()
        : "";

    if (preselectedId && preselectedTitle === wantedTitle) {
      const byId = services.find((service) => String(service?.id || "").trim() === preselectedId);
      if (byId) {
        return byId;
      }
    }

    return services.find((service) => titleOf(service) === wantedTitle) || null;
  }, [services, form.service, preselectService]);

  /* -------------------------------------------------------
     Price calculation.
     
     Fixed service price is used when available.
     For Contact-us services, customer-entered project value
     can be used if provided.
  ------------------------------------------------------- */
  const servicePrice = getServicePrice(selectedService);

  const customProjectValue = Number(form.project_value);

  const fee =
    servicePrice > 0
      ? servicePrice
      : Number.isFinite(customProjectValue) && customProjectValue > 0
        ? customProjectValue
        : 0;

  const gst = Math.round(fee * 0.18);
  const total = fee + gst;

  const isContactPricing =
    selectedService && getServicePrice(selectedService) === 0;

  const consultant =
    agents.find(
      (agent) => agent.name === form.assigned_agent
    ) ||
    agents[0] ||
    {};

  /* -------------------------------------------------------
     Reset modal.
  ------------------------------------------------------- */
  const reset = () => {
    setStep(0);
    setResult(null);
    setFiles([]);
    setPendingBookingId(null);
    setCodOpen(false);
    setSaving(false);

    setForm((previous) => ({
      ...previous,
      service:
      typeof preselectService === "object"
        ? preselectService?.title || preselectService?.name || ""
        : preselectService || "",
      project_value: "",
      description: "",
      start_date: "",
      completion_date: "",
      urgency: "Normal",
      appt_date: "",
      appt_time: "11:00 AM",
      mode: "Google Meet",
      notes: "",
      accurate: false,
      terms: false,
    }));
  };

  /* -------------------------------------------------------
     Continue to next step.
  ------------------------------------------------------- */
  const next = () => {
    if (!user) {
      toast.info(
        "Please sign in or create a customer account before booking a service."
      );

      onOpenChange(false);

      navigate("/login", {
        state: {
          from: {
            pathname: "/customer/services",
          },
        },
      });

      return;
    }

    if (step === 0) {
      if (!form.service) {
        toast.error("Please select a service.");
        return;
      }

      if (!form.company.trim()) {
        toast.error("Company name is required.");
        return;
      }
    }

    setStep((current) => Math.min(current + 1, 2));
  };

  /* -------------------------------------------------------
     Open payment method dialog.
  ------------------------------------------------------- */
  const submit = async () => {
    if (!user) {
      toast.info(
        "Please sign in or create a customer account before booking a service."
      );

      onOpenChange(false);
      navigate("/login");

      return;
    }

    if (!form.service) {
      toast.error("Please select a service.");
      setStep(0);
      return;
    }

    if (!selectedService?.id || !selectedService.live) {
      toast.error(
        "This service is not available for booking right now. Please refresh the services page and select a service created by Admin."
      );
      setStep(0);
      return;
    }

    if (!form.accurate || !form.terms) {
      toast.error(
        "Please accept the confirmations to continue."
      );
      return;
    }

    setSaving(true);

    try {
      setCodOpen(true);
    } catch (error) {
      console.error("BOOKING ERROR:", error);

      toast.error(
        error?.response?.data?.detail ||
          error?.response?.data?.message ||
          error?.message ||
          "Could not create booking. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------------------------------
     Confirm Cash on Delivery booking.
  ------------------------------------------------------- */
  const confirmCOD = async () => {
    if (!user) {
      toast.error("Please login before confirming the booking.");
      return;
    }

    if (!selectedService?.id || !selectedService.live) {
      toast.error(
        "This service is not available for booking right now. Please refresh the services page and select a service created by Admin."
      );
      setCodOpen(false);
      setStep(0);
      return;
    }

    setSaving(true);

    try {
      if (!requestIdRef.current) {
        requestIdRef.current = (window.crypto && window.crypto.randomUUID)
          ? window.crypto.randomUUID()
          : `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      }
      const payload = {
        client_request_id: requestIdRef.current,
        customer: form.company || user.name,
        customer_id: user.id,

        // Canonical MongoDB service name + ID required by /api/bookings.
        service: selectedService.title || form.service,
        service_id: selectedService.id,

        assigned_employee: form.assigned_employee || "",
        // Agent id (when an agent was loaded) so the backend resolves the exact record.
        ...(consultant.id ? { agent_id: consultant.id } : {}),
        assigned_agent: consultant.name || "",

        booking_date: new Date()
          .toISOString()
          .slice(0, 10),

        due_date: form.completion_date || "",

        priority:
          form.urgency === "Normal"
            ? "Low"
            : form.urgency === "High"
              ? "Medium"
              : "High",

        status: "Pending",
        payment_status: "Pending",

        contact_person:
          form.customer_name || user.name,

        email: form.email || user.email,

        mobile:
          form.mobile || user.mobile || "",

        gst_number: form.gst,
        pan: form.pan,

        project_name: form.project_name,

        /*
         * Use the actual selected service fee when a fixed price
         * exists. Otherwise use manually entered project value.
         */
        project_value: fee,

        mode: form.mode,
        appointment_date: form.appt_date,
        appointment_time: form.appt_time,

        notes: form.notes,

        description: form.description,

        start_date: form.start_date,

        turnover: form.turnover,

        estimated_fee: total,

        documents: files.length,
      };

      const response = await api.post(
        "/bookings",
        payload
      );

      const bookingId = response?.data?.data?.id;

      if (!bookingId) {
        throw new Error(
          "Booking was created without a booking ID."
        );
      }

      setPendingBookingId(bookingId);
      requestIdRef.current = null; // booking saved: the next booking is a new attempt

      const reference = bookingId;

      setResult({
        booking_id: bookingId,

        ticket:
          "TKT-" +
          String(bookingId).replace("BKG-", ""),

        reference,

        service: form.service,

        consultant: consultant.name || "NTAXCO Team",

        completion:
          form.completion_date ||
          "Within 7 working days",

        status: "Pending",

        total,

        payment_id: "",
        txn_ref: "",

        payment_status: "Pending",

        date: new Date()
          .toISOString()
          .slice(0, 10),
      });

      setCodOpen(false);

      toast.success(
        "Service booking submitted successfully."
      );
    } catch (error) {
      console.error(
        "BOOKING CONFIRMATION ERROR:",
        error
      );

      toast.error(
        error?.response?.data?.detail ||
          error?.response?.data?.message ||
          error?.message ||
          "Could not confirm the booking."
      );
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------------------------------
     Download receipt.
  ------------------------------------------------------- */
  const receipt = () => {
    if (!result) {
      return;
    }

    exportPDF(
      `Booking ${result.booking_id}`,
      [
        {
          key: "k",
          label: "Field",
        },
        {
          key: "v",
          label: "Value",
        },
      ],
      [
        {
          k: "Booking ID",
          v: result.booking_id,
        },
        {
          k: "Reference No.",
          v: result.reference,
        },
        {
          k: "Ticket",
          v: result.ticket,
        },
        {
          k: "Service",
          v: result.service,
        },
        {
          k: "Customer",
          v: form.company,
        },
        {
          k: "Consultant",
          v: result.consultant,
        },
        {
          k: "Payment ID",
          v: result.payment_id || "-",
        },
        {
          k: "Transaction Ref",
          v: result.txn_ref || result.reference,
        },
        {
          k: "Invoice No.",
          v: result.invoice_no || "-",
        },
        {
          k: "Receipt No.",
          v: result.receipt_no || "-",
        },
        {
          k: "Amount",
          v: inr(result.total),
        },
        {
          k: "Payment Status",
          v: result.payment_status || "Pending",
        },
        {
          k: "Est. Completion",
          v: result.completion,
        },
        {
          k: "Status",
          v: result.status,
        },
      ]
    );

    toast.success("Booking receipt downloaded.");
  };

  /* -------------------------------------------------------
     Close modal.
  ------------------------------------------------------- */
  const close = (isOpen) => {
    if (!isOpen) {
      reset();
    }

    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="book-service-modal"
      >
        <DialogDescription className="sr-only">
          {result
            ? "Your service booking has been submitted. Review the confirmation details."
            : "Choose a service, enter your details and confirm your booking request."}
        </DialogDescription>
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-xl text-[#0A2540]">
                Book a Service
              </DialogTitle>
            </DialogHeader>

            {/* =================================================
                STEPPER
            ================================================= */}
            <div className="flex items-center gap-2 my-3">
              {STEPS.map((stepName, index) => (
                <div
                  key={stepName}
                  className="flex items-center gap-2 flex-1"
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      index <= step
                        ? "bg-royal text-white"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {index + 1}
                  </div>

                  <span
                    className={`text-xs font-medium ${
                      index <= step
                        ? "text-zinc-900"
                        : "text-zinc-400"
                    }`}
                  >
                    {stepName}
                  </span>

                  {index < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 ${
                        index < step
                          ? "bg-royal"
                          : "bg-zinc-100"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{
                  opacity: 0,
                  x: 12,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                exit={{
                  opacity: 0,
                  x: -12,
                }}
                transition={{
                  duration: 0.2,
                }}
              >
                {/* =================================================
                    STEP 1 - DETAILS
                ================================================= */}
                {step === 0 && (
                  <div className="space-y-4">
                    {/* SERVICE DROPDOWN */}
                    <div>
                      <Label className="text-sm font-medium text-zinc-700">
                        Select Service *
                      </Label>

                      <Select
                        value={form.service}
                        onValueChange={(value) =>
                          set("service", value)
                        }
                        disabled={servicesLoading}
                      >
                        <SelectTrigger
                          className="mt-1.5 border-zinc-300"
                          data-testid="bs-service"
                        >
                          <SelectValue
                            placeholder={
                              servicesLoading
                                ? "Loading services..."
                                : "Choose a service"
                            }
                          />
                        </SelectTrigger>

                        <SelectContent className="bg-white max-h-80">
                          {services.map((service) => (
                            <SelectItem
                              key={service.id}
                              value={service.title}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <span>
                                  {service.title}
                                </span>

                                <span className="text-xs text-zinc-500">
                                  {service.price ||
                                    "Contact us"}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {!servicesLoading &&
                        servicesError && (
                          <p className="text-xs text-red-600 mt-1.5">
                            Unable to load services right now. Please try again.
                          </p>
                        )}

                      {!servicesLoading &&
                        !servicesError &&
                        services.length === 0 && (
                          <p className="text-xs text-red-600 mt-1.5">
                            No services are currently
                            available.
                          </p>
                        )}
                    </div>

                    {/* SELECTED SERVICE INFO */}
                    {selectedService && (
                      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-blue-600 font-medium">
                              Selected Service
                            </p>

                            <p className="text-sm font-bold text-[#0A2540] mt-0.5">
                              {selectedService.title}
                            </p>

                            {selectedService.category && (
                              <p className="text-xs text-zinc-500 mt-1">
                                {selectedService.category}
                              </p>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-xs text-zinc-500">
                              Service Price
                            </p>

                            <p className="text-sm font-bold text-[#0A2540]">
                              {selectedService.price ||
                                "Contact us"}
                            </p>
                          </div>
                        </div>

                        {selectedService.description && (
                          <p className="text-xs text-zinc-600 mt-2">
                            {selectedService.description}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-zinc-600">
                          Contact Name
                        </Label>

                        <Input
                          value={form.customer_name}
                          onChange={(event) =>
                            set(
                              "customer_name",
                              event.target.value
                            )
                          }
                          className="mt-1 border-zinc-300"
                          data-testid="bs-name"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-600">
                          Company Name *
                        </Label>

                        <Input
                          value={form.company}
                          onChange={(event) =>
                            set(
                              "company",
                              event.target.value
                            )
                          }
                          className="mt-1 border-zinc-300"
                          data-testid="bs-company"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-600">
                          Email
                        </Label>

                        <Input
                          type="email"
                          value={form.email}
                          onChange={(event) =>
                            set(
                              "email",
                              event.target.value
                            )
                          }
                          className="mt-1 border-zinc-300"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-600">
                          Mobile
                        </Label>

                        <Input
                          value={form.mobile}
                          onChange={(event) =>
                            set(
                              "mobile",
                              event.target.value
                            )
                          }
                          className="mt-1 border-zinc-300"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-600">
                          GSTIN
                        </Label>

                        <Input
                          value={form.gst}
                          onChange={(event) =>
                            set(
                              "gst",
                              event.target.value
                            )
                          }
                          className="mt-1 border-zinc-300"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-600">
                          PAN
                        </Label>

                        <Input
                          value={form.pan}
                          onChange={(event) =>
                            set(
                              "pan",
                              event.target.value
                            )
                          }
                          className="mt-1 border-zinc-300"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-600">
                          Project / Business Name
                        </Label>

                        <Input
                          value={form.project_name}
                          onChange={(event) =>
                            set(
                              "project_name",
                              event.target.value
                            )
                          }
                          className="mt-1 border-zinc-300"
                          data-testid="bs-project"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-600">
                          Estimated Project Value (₹)
                        </Label>

                        <Input
                          type="number"
                          min="0"
                          value={form.project_value}
                          onChange={(event) =>
                            set(
                              "project_value",
                              event.target.value
                            )
                          }
                          className="mt-1 border-zinc-300"
                        />
                      </div>
                    </div>

                    {isContactPricing && (
                      <p className="text-xs text-zinc-500">
                        This service uses custom pricing. You
                        can enter an estimated project value,
                        or our team will contact you for the
                        final quotation.
                      </p>
                    )}

                    <div>
                      <Label className="text-xs text-zinc-600">
                        Project Description
                      </Label>

                      <Textarea
                        value={form.description}
                        onChange={(event) =>
                          set(
                            "description",
                            event.target.value
                          )
                        }
                        placeholder="Describe your requirements in detail."
                        className="mt-1 border-zinc-300"
                      />
                    </div>
                  </div>
                )}

                {/* =================================================
                    STEP 2 - SCHEDULE & DOCUMENTS
                ================================================= */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-zinc-600">
                          Start Date
                        </Label>

                        <Input
                          type="date"
                          value={form.start_date}
                          onChange={(event) =>
                            set(
                              "start_date",
                              event.target.value
                            )
                          }
                          className="mt-1 border-zinc-300"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-600">
                          Required Completion
                        </Label>

                        <Input
                          type="date"
                          value={form.completion_date}
                          onChange={(event) =>
                            set(
                              "completion_date",
                              event.target.value
                            )
                          }
                          className="mt-1 border-zinc-300"
                          data-testid="bs-completion"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-600">
                          Urgency
                        </Label>

                        <Select
                          value={form.urgency}
                          onValueChange={(value) =>
                            set("urgency", value)
                          }
                        >
                          <SelectTrigger className="mt-1 border-zinc-300">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent className="bg-white">
                            {[
                              "Normal",
                              "High",
                              "Critical",
                            ].map((urgency) => (
                              <SelectItem
                                key={urgency}
                                value={urgency}
                              >
                                {urgency}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-600">
                          Preferred Date
                        </Label>

                        <Input
                          type="date"
                          value={form.appt_date}
                          onChange={(event) =>
                            set(
                              "appt_date",
                              event.target.value
                            )
                          }
                          className="mt-1 border-zinc-300"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-600">
                          Preferred Time
                        </Label>

                        <Input
                          value={form.appt_time}
                          onChange={(event) =>
                            set(
                              "appt_time",
                              event.target.value
                            )
                          }
                          className="mt-1 border-zinc-300"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-zinc-600">
                          Meeting Mode
                        </Label>

                        <Select
                          value={form.mode}
                          onValueChange={(value) =>
                            set("mode", value)
                          }
                        >
                          <SelectTrigger className="mt-1 border-zinc-300">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent className="bg-white">
                            {[
                              "Office Visit",
                              "Phone Call",
                              "Google Meet",
                              "Microsoft Teams",
                              "Zoom",
                            ].map((mode) => (
                              <SelectItem
                                key={mode}
                                value={mode}
                              >
                                {mode}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* DOCUMENTS */}
                    <div>
                      <Label className="text-xs text-zinc-600">
                        Upload Documents
                      </Label>

                      <label
                        className="mt-1 flex items-center justify-center gap-2 border-2 border-dashed border-zinc-300 rounded-xl py-6 cursor-pointer hover:border-royal transition-colors"
                        data-testid="bs-upload"
                      >
                        <Upload className="h-5 w-5 text-zinc-400" />

                        <span className="text-sm text-zinc-500">
                          Click to upload (PDF, JPG, PNG,
                          DOCX, XLSX)
                        </span>

                        <input
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
                          className="hidden"
                          onChange={(event) => {
                            const selectedFiles =
                              Array.from(
                                event.target.files || []
                              );

                            setFiles((current) => [
                              ...current,
                              ...selectedFiles.map(
                                (file) => file.name
                              ),
                            ]);

                            event.target.value = "";
                          }}
                        />
                      </label>

                      {files.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {files.map((file, index) => (
                            <span
                              key={`${file}-${index}`}
                              className="inline-flex items-center gap-1 text-xs bg-zinc-100 rounded-full px-2.5 py-1"
                            >
                              <FileText className="h-3 w-3" />

                              {file}

                              <button
                                type="button"
                                onClick={() =>
                                  setFiles((current) =>
                                    current.filter(
                                      (_, fileIndex) =>
                                        fileIndex !==
                                        index
                                    )
                                  )
                                }
                              >
                                <X className="h-3 w-3 text-zinc-500" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="text-xs text-zinc-600">
                        Additional Notes
                      </Label>

                      <Textarea
                        value={form.notes}
                        onChange={(event) =>
                          set(
                            "notes",
                            event.target.value
                          )
                        }
                        placeholder="Anything else we should know?"
                        className="mt-1 border-zinc-300"
                      />
                    </div>
                  </div>
                )}

                {/* =================================================
                    STEP 3 - REVIEW
                ================================================= */}
                {step === 2 && (
                  <div className="space-y-4">
                    {/* CONSULTANT */}
                    <div
                      className="rounded-xl border border-zinc-200 p-4 bg-royal-faint/40 flex items-center gap-3"
                      data-testid="bs-consultant"
                    >
                      <div className="h-12 w-12 rounded-full bg-royal text-white flex items-center justify-center font-bold">
                        {consultant.initials ||
                          (consultant.name
                            ? consultant.name
                                .split(" ")
                                .map(
                                  (part) =>
                                    part[0]
                                )
                                .join("")
                                .slice(0, 2)
                            : "NT")}
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-semibold text-zinc-900">
                          Assigned Consultant:{" "}
                          {consultant.name ||
                            "NTAXCO Team"}
                        </p>

                        {(consultant.spec ||
                          consultant.exp ||
                          consultant.rating) && (
                          <p className="text-xs text-muted-foreground">
                            {consultant.spec || ""}
                            {consultant.exp
                              ? ` · ${consultant.exp}`
                              : ""}
                            {consultant.rating
                              ? ` · ★ ${consultant.rating}`
                              : ""}
                          </p>
                        )}
                      </div>

                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Available
                      </span>
                    </div>

                    {/* PAYMENT ESTIMATE */}
                    <div className="rounded-xl border border-zinc-200 p-4">
                      <p className="text-sm font-semibold text-zinc-900 mb-2">
                        Payment Estimation
                      </p>

                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Service Fee
                          </span>

                          <span>
                            {fee > 0
                              ? inr(fee)
                              : "Contact us"}
                          </span>
                        </div>

                        {fee > 0 && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                GST (18%)
                              </span>

                              <span>
                                {inr(gst)}
                              </span>
                            </div>

                            <div className="flex justify-between font-bold text-zinc-900 border-t border-zinc-100 pt-1.5">
                              <span>
                                Total Estimate
                              </span>

                              <span>
                                {inr(total)}
                              </span>
                            </div>
                          </>
                        )}

                        {fee === 0 && (
                          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
                            Final pricing will be confirmed
                            by the NTAXCO team.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* REVIEW DETAILS */}
                    <div className="rounded-xl border border-zinc-200 p-4 text-sm grid sm:grid-cols-2 gap-y-3 gap-x-6">
                      <div className="flex justify-between sm:block">
                        <span className="text-muted-foreground sm:text-xs">
                          Service
                        </span>

                        <span className="font-medium sm:block">
                          {form.service || "—"}
                        </span>
                      </div>

                      <div className="flex justify-between sm:block">
                        <span className="text-muted-foreground sm:text-xs">
                          Company
                        </span>

                        <span className="font-medium sm:block">
                          {form.company || "—"}
                        </span>
                      </div>

                      <div className="flex justify-between sm:block">
                        <span className="text-muted-foreground sm:text-xs">
                          Contact
                        </span>

                        <span className="font-medium sm:block">
                          {form.customer_name ||
                            "—"}
                        </span>
                      </div>

                      <div className="flex justify-between sm:block">
                        <span className="text-muted-foreground sm:text-xs">
                          Mobile
                        </span>

                        <span className="font-medium sm:block">
                          {form.mobile || "—"}
                        </span>
                      </div>

                      <div className="flex justify-between sm:block">
                        <span className="text-muted-foreground sm:text-xs">
                          Mode
                        </span>

                        <span className="font-medium sm:block">
                          {form.mode}
                        </span>
                      </div>

                      <div className="flex justify-between sm:block">
                        <span className="text-muted-foreground sm:text-xs">
                          Urgency
                        </span>

                        <span className="font-medium sm:block">
                          {form.urgency}
                        </span>
                      </div>

                      <div className="flex justify-between sm:block">
                        <span className="text-muted-foreground sm:text-xs">
                          Documents
                        </span>

                        <span className="font-medium sm:block">
                          {files.length}
                        </span>
                      </div>
                    </div>

                    {/* CONFIRMATIONS */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-zinc-700">
                        <Checkbox
                          checked={form.accurate}
                          onCheckedChange={(value) =>
                            set(
                              "accurate",
                              !!value
                            )
                          }
                          data-testid="bs-accurate"
                        />

                        I confirm the provided
                        information is accurate.
                      </label>

                      <label className="flex items-center gap-2 text-sm text-zinc-700">
                        <Checkbox
                          checked={form.terms}
                          onCheckedChange={(value) =>
                            set(
                              "terms",
                              !!value
                            )
                          }
                          data-testid="bs-terms"
                        />

                        I agree to the Terms &
                        Conditions.
                      </label>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* =================================================
                NAVIGATION BUTTONS
            ================================================= */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-300"
                disabled={step === 0 || saving}
                onClick={() =>
                  setStep(
                    (current) =>
                      Math.max(current - 1, 0)
                  )
                }
              >
                <ChevronLeft className="h-4 w-4 mr-1" />

                Back
              </Button>

              {step < 2 ? (
                <Button
                  type="button"
                  className="bg-royal text-white hover:bg-royal-hover font-semibold"
                  onClick={next}
                  data-testid="bs-next"
                >
                  Continue

                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  className="bg-brand text-[#0A2540] hover:bg-brand-hover font-bold"
                  onClick={submit}
                  disabled={saving}
                  data-testid="bs-submit"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />

                      Processing...
                    </>
                  ) : (
                    "Proceed to Payment"
                  )}
                </Button>
              )}
            </div>
          </>
        ) : (
          /* =====================================================
             SUCCESS SCREEN
          ===================================================== */
          <div
            className="py-4 text-center"
            data-testid="bs-success"
          >
            <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>

            <h3 className="font-heading text-xl font-bold text-[#0A2540]">
              Service Booked — Confirmation Complete!
            </h3>

            <p className="text-sm text-muted-foreground mt-1">
              Your service booking is confirmed.
              Payment method: Cash on Delivery.
            </p>

            <div className="mt-5 rounded-xl border border-zinc-200 p-4 text-left text-sm space-y-2">
              {[
                [
                  "Booking ID",
                  result.booking_id,
                ],
                [
                  "Reference No.",
                  result.reference,
                ],
                ["Ticket", result.ticket],
                ["Service", result.service],
                [
                  "Assigned Consultant",
                  result.consultant,
                ],
                [
                  "Amount",
                  result.total > 0
                    ? inr(result.total)
                    : "Contact us",
                ],
                [
                  "Payment Status",
                  result.payment_status,
                ],
                [
                  "Est. Completion",
                  result.completion,
                ],
                ["Status", result.status],
              ]
                .filter((row) => row[1])
                .map((row) => (
                  <div
                    key={row[0]}
                    className="flex justify-between border-b border-zinc-100 last:border-0 pb-1.5"
                  >
                    <span className="text-muted-foreground">
                      {row[0]}
                    </span>

                    <span className="font-medium text-zinc-900 text-right ml-4">
                      {row[1]}
                    </span>
                  </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 justify-center mt-5">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-300"
                onClick={receipt}
                data-testid="bs-receipt"
              >
                <Download className="h-4 w-4 mr-1.5" />

                Download Receipt
              </Button>

              <Button
                type="button"
                variant="outline"
                className="border-zinc-300"
                onClick={() => {
                  close(false);
                  navigate("/customer/bookings");
                }}
              >
                Track Booking
              </Button>

              <Button
                type="button"
                className="bg-royal text-white hover:bg-royal-hover font-semibold"
                onClick={() => {
                  close(false);
                  navigate("/customer/dashboard");
                }}
              >
                <LayoutDashboard className="h-4 w-4 mr-1.5" />

                Go to Dashboard
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* =======================================================
          PAYMENT METHOD DIALOG
      ======================================================= */}
      <Dialog
        open={codOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen && !saving) {
            setCodOpen(false);
          }
        }}
      >
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-[#0A2540]">
              Choose Payment Method
            </DialogTitle>
            <DialogDescription className="sr-only">
              Choose how you would like to pay for this service booking.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border-2 border-[#FFB800] bg-[#FFB800]/10 p-5">
            <p className="font-heading font-bold text-[#0A2540]">
              Cash on Delivery
            </p>

            <p className="text-sm text-slate-600 mt-1">
              No online payment is required now. Your
              service will be booked and the amount will
              remain pending for collection.
            </p>

            <div className="flex justify-between mt-4 pt-4 border-t border-[#FFB800]/30 font-semibold">
              <span>Total</span>

              <span>
                {total > 0
                  ? inr(total)
                  : "To be confirmed"}
              </span>
            </div>
          </div>

          <Button
            type="button"
            onClick={confirmCOD}
            disabled={saving}
            className="w-full bg-brand text-[#0A2540] hover:bg-brand-hover font-bold h-11"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />

                Confirming...
              </>
            ) : (
              "Proceed with Cash on Delivery"
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

