import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { SparrowMascot } from "../../components/SparrowMascot";
import { Sheet } from "../../components/ui/Sheet";
import type { Bill, Settings } from "../../lib/api/data";
import { APPLIANCE_OPTIONS, HOME_OPTIONS, PEOPLE_OPTIONS } from "../../lib/setupOptions";
import type { HomeType, Profile } from "../../lib/types";
import { missionResult } from "../../lib/impact";
import { VerificationResult } from "./VerificationResult";

/** Weekday chips in the export's order. Labels are i18n keys. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** "My Nest": edit home type, people, city and appliances, then Save. */
export function NestSheet({
  open,
  profile,
  onSave,
  onClose,
}: {
  open: boolean;
  profile: Profile | null;
  onSave: (answers: { homeType: HomeType | null; people: string | null; city: string | null; appliances: string[] }) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [homeType, setHomeType] = useState<HomeType | null>(null);
  const [people, setPeople] = useState<string>("");
  const [city, setCity] = useState("");
  const [appliances, setAppliances] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setHomeType(profile?.answers.homeType ?? null);
    setPeople(profile?.answers.people ?? "");
    setCity(profile?.answers.city ?? "");
    setAppliances(profile?.answers.appliances ?? []);
    setSaved(false);
  }, [open, profile]);

  const toggle = (item: string) =>
    setAppliances((all) => (all.includes(item) ? all.filter((x) => x !== item) : [...all, item]));

  const save = async () => {
    setBusy(true);
    try {
      await onSave({ homeType, people: people || null, city: city || null, appliances });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={t("profile.nestEyebrow")}
      sheetClassName="sheet nest-sheet"
      closeLabel={t("common.close")}
    >
      <div className="eyebrow">{t("profile.nestEyebrow")}</div>
      <h2>{t("profile.nestTitle")}</h2>
      <fieldset>
        <legend>{t("profile.homeType")}</legend>
        {HOME_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={homeType === option.value ? "selected" : ""}
            onClick={() => setHomeType(option.value)}
          >
            {t(option.labelKey)}
            {homeType === option.value ? <Icon name="check" size={16} /> : null}
          </button>
        ))}
      </fieldset>
      <label>
        {t("profile.people")}
        <select value={people} onChange={(event) => setPeople(event.target.value)}>
          <option value="">{t("profile.peoplePlaceholder")}</option>
          {PEOPLE_OPTIONS.map((option) => (
            <option key={option.label} value={option.label}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("profile.city")}
        <input value={city} onChange={(event) => setCity(event.target.value)} />
      </label>
      <fieldset>
        <legend>{t("profile.appliances")}</legend>
        {APPLIANCE_OPTIONS.map((option) => (
          <button
            type="button"
            className={appliances.includes(option.label) ? "selected" : ""}
            key={option.label}
            onClick={() => toggle(option.label)}
          >
            {t(option.labelKey)}
            {appliances.includes(option.label) ? <Icon name="check" size={16} /> : null}
          </button>
        ))}
      </fieldset>
      <button className="primary-button wide" disabled={busy} onClick={() => void save()}>
        {saved ? t("profile.saved") : t("profile.save")} <Icon name="check" size={18} />
      </button>
    </Sheet>
  );
}

/** Bills: month, units, amount and verified status; tap one to see its result. */
export function BillsSheet({
  open,
  bills,
  demo,
  error,
  onRetry,
  onAdd,
  onShare,
  onClose,
}: {
  open: boolean;
  bills: Bill[];
  demo: boolean;
  /** True when the bill list could not be read; shows the error state. */
  error: boolean;
  onRetry: () => void;
  onAdd: () => void;
  onShare: (kwh: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<"loading" | "list">("loading");
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    if (error) return;
    setState("loading");
    const timer = window.setTimeout(() => setState("list"), 400);
    return () => window.clearTimeout(timer);
  }, [open, error]);

  const selectedBill = selected === null ? null : bills[selected];
  const previousBill = selected === null ? null : bills[selected + 1];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={t("bills.eyebrow")}
      sheetClassName="sheet bills-list"
      closeLabel={t("common.close")}
    >
      <div className="eyebrow">{t("bills.eyebrow")}</div>
      <h2>{t("bills.title")}</h2>
      {error ? (
        <div className="list-state">
          <Icon name="bill" size={34} />
          <strong>{t("bills.errorTitle")}</strong>
          <p>{t("bills.errorCopy")}</p>
          <button className="quiet-button" onClick={onRetry}>
            {t("bills.retry")}
          </button>
        </div>
      ) : state === "loading" ? (
        <div className="loading-state compact">
          <span className="spinner" />
          <strong>{t("bills.loading")}</strong>
        </div>
      ) : selectedBill && previousBill ? (
        <>
          <VerificationResult
            previous={previousBill}
            bill={selectedBill}
            demo={demo}
            onShare={onShare}
            onClose={() => setSelected(null)}
          />
          <button className="quiet-button" onClick={() => setSelected(null)}>
            {t("bills.back")}
          </button>
        </>
      ) : selectedBill ? (
        <div className="bill-result">
          <SparrowMascot pose="curious" size={90} />
          <span>{t("bills.baselineEyebrow")}</span>
          <h3>{selectedBill.month}</h3>
          <strong>{t("bills.units", { units: selectedBill.units })}</strong>
          <p>{t("bills.baselineCopy")}</p>
          <button className="quiet-button" onClick={() => setSelected(null)}>
            {t("bills.back")}
          </button>
        </div>
      ) : bills.length ? (
        <div className="bill-rows">
          {bills.map((bill, index) => (
            <button key={bill.id} type="button" onClick={() => setSelected(index)}>
              <span className="bill-row-icons">
                <Icon name="bill" />
                {bill.hasPhoto ? <Icon name="camera" size={16} /> : null}
              </span>
              <span>
                <strong>{bill.month}</strong>
                <small>
                  {t("bills.units", { units: bill.units })}
                  {typeof bill.amount === "number"
                    ? ` · ${t("common.rupeesFigure", { amount: bill.amount })}`
                    : ""}
                </small>
              </span>
              <b>
                {index < bills.length - 1 && missionResult(bills[index + 1].units, bill.units).verified
                  ? t("bills.verified")
                  : t("bills.baseline")}
              </b>
            </button>
          ))}
        </div>
      ) : (
        <div className="bill-result">
          <SparrowMascot pose="curious" size={90} />
          <span>{t("bills.emptyEyebrow")}</span>
          <p>{t("bills.emptyCopy")}</p>
        </div>
      )}
      <div className="bill-list-actions">
        <button className="quiet-button" onClick={onClose}>
          {t("bills.close")}
        </button>
        <button className="primary-button" onClick={onAdd}>
          <Icon name="bill" size={18} /> {t("bills.add")}
        </button>
      </div>
    </Sheet>
  );
}

/** Reminders: device-local only. The line says so; nothing claims a send. */
export function RemindersSheet({
  open,
  settings,
  onSave,
  onClose,
}: {
  open: boolean;
  settings: Settings;
  onSave: (settings: Settings) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(settings.reminders.enabled);
  const [time, setTime] = useState(settings.reminders.time);
  const [days, setDays] = useState<string[]>(settings.reminders.days);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEnabled(settings.reminders.enabled);
    setTime(settings.reminders.time);
    setDays(settings.reminders.days);
  }, [open, settings]);

  const toggleDay = (day: string) =>
    setDays((all) => (all.includes(day) ? all.filter((x) => x !== day) : [...all, day]));

  const save = async () => {
    setBusy(true);
    try {
      await onSave({ ...settings, reminders: { enabled, time, days } });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={t("reminders.eyebrow")}
      sheetClassName="sheet reminder-sheet"
      closeLabel={t("common.close")}
    >
      <div className="eyebrow">{t("reminders.eyebrow")}</div>
      <h2>{t("reminders.title")}</h2>
      <button className="toggle-row" type="button" onClick={() => setEnabled(!enabled)}>
        <span>
          <strong>{t("reminders.missionReminders")}</strong>
          <small>{t("reminders.savedOnDevice")}</small>
        </span>
        <span className={`toggle ${enabled ? "on" : ""}`}><i /></span>
      </button>
      <label>
        {t("reminders.time")}
        <input type="time" value={time} disabled={!enabled} onChange={(event) => setTime(event.target.value)} />
      </label>
      <div className="weekday-chips">
        {WEEKDAYS.map((day) => (
          <button
            type="button"
            disabled={!enabled}
            className={days.includes(day) ? "selected" : ""}
            key={day}
            onClick={() => toggleDay(day)}
          >
            {t(`reminders.day.${day}`)}
          </button>
        ))}
      </div>
      <button className="primary-button wide" disabled={busy} onClick={() => void save()}>
        {t("reminders.save")}
      </button>
    </Sheet>
  );
}

/** Confirmation sheet. Delete needs the exact word DELETE; sign out is plain. */
export function ConfirmSheet({
  open,
  kind,
  onConfirm,
  onBack,
}: {
  open: boolean;
  kind: "delete" | "signout" | "reset";
  onConfirm: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const deleting = kind === "delete";
  const resetting = kind === "reset";

  useEffect(() => {
    if (open) setValue("");
  }, [open, kind]);

  return (
    <Sheet
      open={open}
      onClose={onBack}
      label={deleting ? t("confirm.deleteTitle") : resetting ? t("confirm.resetTitle") : t("confirm.signOutTitle")}
      sheetClassName="sheet confirm-sheet"
      closeLabel={t("common.close")}
    >
      <Icon name={deleting || resetting ? "trash" : "logout"} size={36} />
      <h2>{deleting ? t("confirm.deleteTitle") : resetting ? t("confirm.resetTitle") : t("confirm.signOutTitle")}</h2>
      <p>{deleting ? t("confirm.deleteCopy") : resetting ? t("confirm.resetCopy") : t("confirm.signOutCopy")}</p>
      {deleting ? (
        <label>
          {t("confirm.deleteLabel")}
          <input value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
      ) : null}
      <div className="confirm-actions">
        <button className="quiet-button" onClick={onBack}>
          {t("confirm.cancel")}
        </button>
        <button
          className={deleting ? "danger-button" : "primary-button"}
          disabled={deleting && value !== "DELETE"}
          onClick={onConfirm}
        >
          {deleting ? t("confirm.deleteConfirm") : resetting ? t("confirm.resetConfirm") : t("confirm.signOutConfirm")}
        </button>
      </div>
    </Sheet>
  );
}
