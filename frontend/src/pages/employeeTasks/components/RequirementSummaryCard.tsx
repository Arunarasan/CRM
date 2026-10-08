import { useEffect, useState } from 'react';
import { CheckCircle2, User, Phone, MapPin, Home, FileText, Wallet, CalendarClock } from 'lucide-react';
import { formatTime } from '@/pages/leads/constants';
import { employeeTaskApi } from '@/api/employeeTaskApi';

/**
 * Read-only summary of what was captured on a "Collect Requirement" task, shown on the task detail
 * page once the form has been submitted (task locked / awaiting approval / completed). Lets the field
 * employee review exactly what they collected — the same groups as the capture form, values only,
 * empty sections hidden. Sourced from the stored submission via the lead-form draft endpoint.
 */

const SCOPE_LABELS: Record<string, string> = {
  reqKitchen: 'Modular Kitchen', reqWardrobe: 'Wardrobe', reqTvUnit: 'TV Unit',
  reqFalseCeiling: 'False Ceiling', reqPainting: 'Painting', reqFlooring: 'Flooring',
  reqElectrical: 'Electrical', reqPlumbing: 'Plumbing', reqWoodFinish: 'Wood Finish',
};

type Data = Record<string, any>;

const has = (v: unknown) => v != null && String(v).trim() !== '';
const money = (v: unknown) => (has(v) ? '₹' + Number(v).toLocaleString('en-IN') : null);
const fmtDate = (s?: unknown) =>
  has(s) ? new Date(s as string).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[#A6A99E]">{label}</span>
      <span className="whitespace-pre-wrap break-words text-[13.5px] leading-snug text-[#33392F]">{value}</span>
    </div>
  );
}

function Group({ icon, title, children, show }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; show: boolean;
}) {
  if (!show) return null;
  return (
    <div className="rounded-xl border border-[#EFE9DC] bg-[#FBFAF6] p-3.5">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9B6B32]">
        <span className="text-[#9B6B32]">{icon}</span> {title}
      </p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

export default function RequirementSummaryCard({ taskId }: { taskId: number }) {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    employeeTaskApi.leadFormDraft(taskId)
      .then((res) => { if (alive) setD(res || {}); })
      .catch(() => { if (alive) setD({}); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [taskId]);

  if (loading) return null;
  if (!d || Object.keys(d).length === 0) return null;

  const budget =
    money(d.estimatedBudget) ||
    (has(d.minimumBudget) || has(d.maximumBudget)
      ? [money(d.minimumBudget), money(d.maximumBudget)].filter(Boolean).join(' – ')
      : null);
  const description = d.projectDescription || d.customerRequirements;
  const finish = [d.preferredDesignStyle, d.preferredMaterial, d.preferredColorTheme].filter(has).join(' · ');
  const addr = [d.address, d.city, d.district, d.state, d.pincode].filter(has).join(', ');
  const scope = Object.keys(SCOPE_LABELS).filter((k) => d[k] === true || d[k] === 'true').map((k) => SCOPE_LABELS[k]);
  const timeline = [
    fmtDate(d.expectedStartDate) && `Start ${fmtDate(d.expectedStartDate)}`,
    fmtDate(d.preferredCompletionDate) && `Target ${fmtDate(d.preferredCompletionDate)}`,
    d.estimatedDuration,
  ].filter(Boolean).join(' · ');

  const showSummary = has(d.name) || has(d.companyName) || has(d.leadType) || has(d.leadSource) || has(d.rating) || has(d.priority) || has(d.leadTemperature) || has(d.gstNumber);
  const showContact = has(d.mobileNumber) || has(d.alternateMobile) || has(d.whatsappNumber) || has(d.email);
  const showAddress = has(addr) || has(d.landmark);
  const showProperty = has(d.propertyType) || has(d.propertyName) || has(d.currentConstructionStage) ||
    has(d.floorCount) || has(d.areaSqft) || has(d.expectedWorkArea) || has(d.siteAddress);
  const showReq = has(d.requirementCategory) || has(d.requirementProduct) || has(description) || has(d.roomsRequired) || has(d.specialRequests) || has(finish);
  const showBudget = !!budget || has(d.expectedProjectValue) || has(d.paymentPreference) || !!timeline;
  const showNext = has(d.siteVisitDate) || has(d.followUpDate);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_4px_16px_rgba(80,55,20,0.06)]">
      <div className="h-1 bg-gradient-to-r from-[#0A573B] via-[#0A573B] to-[#BC8748]" />
      <div className="p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2C7050]">
          <CheckCircle2 className="h-3.5 w-3.5" /> Requirement submitted
        </p>
        <p className="mb-3 text-[12.5px] text-[#8A8F86]">What you captured and saved onto the lead.</p>

        <div className="flex flex-col gap-3">
          <Group icon={<CalendarClock className="h-3.5 w-3.5" />} title="Next step" show={showNext}>
            {has(d.siteVisitDate)
              ? <Field label="Site visit scheduled" value={fmtDate(d.siteVisitDate)} />
              : <>
                  <Field label="Follow-up scheduled" value={[fmtDate(d.followUpDate), formatTime(d.followUpTime)].filter(Boolean).join(', ')} />
                  <Field label="Follow-up notes" value={d.followUpNotes} />
                </>}
          </Group>

          <Group icon={<FileText className="h-3.5 w-3.5" />} title="Requirement" show={showReq}>
            <Field label="Categories" value={d.requirementCategory} />
            <Field label="Products asked" value={d.requirementProduct} />
            <Field label="Requirement" value={description} />
            <Field label="Rooms" value={d.roomsRequired} />
            {scope.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[#A6A99E]">Scope of work</span>
                <div className="flex flex-wrap gap-1.5">
                  {scope.map((s) => (
                    <span key={s} className="rounded-full bg-[#F0F5F1] px-2.5 py-1 text-[11.5px] font-medium text-[#2C7050] ring-1 ring-[#CFE3D6]">{s}</span>
                  ))}
                </div>
              </div>
            )}
            <Field label="Preferences" value={finish || undefined} />
            <Field label="Special requests" value={d.specialRequests} />
          </Group>

          <Group icon={<Wallet className="h-3.5 w-3.5" />} title="Budget & timeline" show={showBudget}>
            <Field label="Budget" value={budget || undefined} />
            <Field label="Expected value" value={money(d.expectedProjectValue) || undefined} />
            <Field label="Payment" value={d.paymentPreference} />
            <Field label="Timeline" value={timeline || undefined} />
          </Group>

          <Group icon={<User className="h-3.5 w-3.5" />} title="Lead summary" show={showSummary}>
            <Field label="Name" value={d.name} />
            <Field label="Company" value={d.companyName} />
            <Field label="Type / priority" value={[d.leadType, has(d.priority) ? `${d.priority} priority` : null, d.leadTemperature].filter(has).join(' · ') || undefined} />
            <Field label="Source" value={d.leadSource} />
            <Field label="Quality rating" value={has(d.rating) ? `${d.rating} / 5` : undefined} />
            <Field label="GST" value={d.gstNumber} />
          </Group>

          <Group icon={<Phone className="h-3.5 w-3.5" />} title="Contact" show={showContact}>
            <Field label="Mobile" value={[d.mobileNumber, d.alternateMobile].filter(has).join(' · ') || undefined} />
            <Field label="WhatsApp" value={d.whatsappNumber} />
            <Field label="Email" value={d.email} />
          </Group>

          <Group icon={<MapPin className="h-3.5 w-3.5" />} title="Address" show={showAddress}>
            <Field label="Address" value={addr || undefined} />
            <Field label="Landmark" value={d.landmark} />
          </Group>

          <Group icon={<Home className="h-3.5 w-3.5" />} title="Property" show={showProperty}>
            <Field label="Type" value={d.propertyType} />
            <Field label="Name" value={d.propertyName} />
            <Field label="Construction stage" value={d.currentConstructionStage} />
            <Field label="Floors" value={has(d.floorCount) ? String(d.floorCount) : undefined} />
            <Field label="Total area" value={has(d.areaSqft) ? `${d.areaSqft} sq.ft` : undefined} />
            <Field label="Work area" value={has(d.expectedWorkArea) ? `${d.expectedWorkArea} sq.ft` : undefined} />
            <Field label="Site address" value={d.siteAddress} />
          </Group>

          <Field label="Remarks" value={d.remarks} />
          <Field label="Notes" value={d.notes} />
        </div>
      </div>
    </div>
  );
}
