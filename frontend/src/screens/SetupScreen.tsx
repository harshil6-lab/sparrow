import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/Button";
import { ProgressBar } from "../components/ui/ProgressBar";
import { OptionCard } from "../components/ui/OptionCard";
import { SparrowLogo } from "../components/SparrowLogo";
import { Icon, type IconName } from "../components/Icon";
import { SetupArt } from "../components/scenes/SetupArt";
import { useAuth } from "../lib/AuthProvider";
import type { HomeType, SetupAnswers } from "../lib/types";
import citiesData from "../data/cities.json";

interface CityRow {
  city: string;
  state: string;
}

const CITIES = citiesData.cities as CityRow[];

const HOME_OPTIONS: { key: string; labelKey: string; value: HomeType; icon: IconName }[] = [
  { key: "apartment", labelKey: "setup.homeApartment", value: "apartment", icon: "apartment" },
  { key: "independent", labelKey: "setup.homeIndependent", value: "independent", icon: "home" },
  { key: "row", labelKey: "setup.homeRow", value: "row", icon: "row" },
];
const PEOPLE_OPTIONS = [
  { label: "Just me", labelKey: "setup.people1", icon: "people1" as IconName },
  { label: "2 people", labelKey: "setup.people2", icon: "people2" as IconName },
  { label: "3–4 people", labelKey: "setup.people4", icon: "people4" as IconName },
  { label: "5+ people", labelKey: "setup.people5", icon: "people5" as IconName },
];
const BILL_OPTIONS = [
  { label: "Under ₹1,000", labelKey: "setup.billUnder1k", icon: "coin1" as IconName },
  { label: "₹1,000–2,500", labelKey: "setup.bill1k2_5k", icon: "coin2" as IconName },
  { label: "₹2,500–5,000", labelKey: "setup.bill2_5k5k", icon: "coin3" as IconName },
  { label: "Over ₹5,000", labelKey: "setup.billOver5k", icon: "coin4" as IconName },
];
const APPLIANCE_OPTIONS = [
  { label: "Air conditioner", labelKey: "setup.applianceAc", icon: "ac" as IconName },
  { label: "Geyser", labelKey: "setup.applianceGeyser", icon: "geyser" as IconName },
  { label: "Washing machine", labelKey: "setup.applianceWasher", icon: "washer" as IconName },
  { label: "Refrigerator", labelKey: "setup.applianceFridge", icon: "fridge" as IconName },
  { label: "Water pump", labelKey: "setup.appliancePump", icon: "pump" as IconName },
  { label: "Induction", labelKey: "setup.applianceInduction", icon: "induction" as IconName },
];

const SCENE_LINES = [
  "Let’s begin with the ground beneath you.",
  "Now I can see your kind of home.",
  "Aha, here comes the family!",
  "Your city changes the rhythm.",
  "The bill sky completes the picture.",
];

export function SetupScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { completeSetup } = useAuth();

  const [step, setStep] = useState(0);
  const [homeType, setHomeType] = useState<HomeType | null>(null);
  const [people, setPeople] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [bill, setBill] = useState<string | null>(null);
  const [appliances, setAppliances] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [customCity, setCustomCity] = useState(false);
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    const byState = new Map<string, string[]>();
    for (const row of CITIES) {
      if (q && !row.city.toLowerCase().includes(q) && !row.state.toLowerCase().includes(q)) continue;
      const bucket = byState.get(row.state) ?? [];
      bucket.push(row.city);
      byState.set(row.state, bucket);
    }
    return [...byState.entries()];
  }, [citySearch]);

  const suggestions = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return CITIES.filter((row) => row.city.toLowerCase().includes(q)).slice(0, 5).map((row) => row.city);
  }, [citySearch]);

  const selectedForStep = (index: number): string[] => {
    if (index === 0) return homeType ? [homeType] : [];
    if (index === 1) return people ? [people] : [];
    if (index === 2) return city ? [city] : [];
    if (index === 3) return bill ? [bill] : [];
    return appliances;
  };

  const canContinue = selectedForStep(step).length > 0;

  const finish = async () => {
    setSaving(true);
    const answers: Partial<SetupAnswers> = { homeType, people, city, usualBill: bill, appliances };
    await completeSetup(answers);
    setSaving(false);
    navigate("/ready", { replace: true });
  };

  const headings = [
    { eyebrow: "homeEyebrow", title: "homeTitle", copy: "homeCopy" },
    { eyebrow: "familyTitle", title: "familyTitle", copy: "familyCopy" },
    { eyebrow: "cityTitle", title: "cityTitle", copy: "cityCopy" },
    { eyebrow: "billTitle", title: "billTitle", copy: "billCopy" },
    { eyebrow: "appliancesTitle", title: "appliancesTitle", copy: "appliancesCopy" },
  ][step];

  return (
    <main className="setup-screen">
      <aside>
        <SparrowLogo light />
        <SetupArt step={step} home={homeType} people={people} lines={SCENE_LINES} />
        <div className="setup-facts">
          {homeType ? <span><Icon name="check" size={14} /> {homeType}</span> : null}
          {people ? <span><Icon name="check" size={14} /> {people}</span> : null}
          {city ? <span><Icon name="check" size={14} /> {city}</span> : null}
          {bill ? <span><Icon name="check" size={14} /> {bill}</span> : null}
          {appliances.length > 0 ? <span><Icon name="check" size={14} /> {appliances.length}</span> : null}
        </div>
      </aside>

      <section className="setup-main">
        <div className="setup-top">
          <span>{t("setup.stepOf", { n: step + 1 })}</span>
        </div>
        <ProgressBar value={step + 1} max={5} label={t("setup.stepOf", { n: step + 1 })} />

        <div className="setup-content">
          <div className="mobile-scene">
            <SetupArt step={step} home={homeType} people={people} lines={SCENE_LINES} />
          </div>
          <div className="eyebrow">{t(`setup.${headings.eyebrow}`)}</div>
          <h1>{t(`setup.${headings.title}`)}</h1>
          <p>{t(`setup.${headings.copy}`)}</p>

          {step === 0 && (
            <div className="option-grid">
              {HOME_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.key}
                  icon={opt.icon}
                  label={t(opt.labelKey)}
                  selected={homeType === opt.value}
                  onClick={() => setHomeType(opt.value)}
                />
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="option-grid">
              {PEOPLE_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.label}
                  icon={opt.icon}
                  label={t(opt.labelKey)}
                  selected={people === opt.label}
                  onClick={() => setPeople(opt.label)}
                />
              ))}
            </div>
          )}

          {step === 2 && (
            <>
              <input
                className="city-search"
                value={citySearch}
                onChange={(event) => setCitySearch(event.target.value)}
                placeholder={customCity ? t("setup.citySearchCustomPlaceholder") : t("setup.citySearchPlaceholder")}
                aria-label={t("setup.citySearchLabel")}
              />
              <button type="button" className="unlisted-city" onClick={() => setCustomCity((v) => !v)}>
                <Icon name="pin" size={18} /> {t("setup.cityUnlisted")}
              </button>
              {customCity && (
                <div className="city-suggestions">
                  {suggestions.map((name) => (
                    <button key={name} type="button" onClick={() => { setCity(name); setCitySearch(name); }}>{name}</button>
                  ))}
                  <button
                    type="button"
                    disabled={!citySearch.trim()}
                    onClick={() => setCity(citySearch.trim())}
                  >
                    {t("setup.cityUse", { city: citySearch.trim() || t("setup.cityMyPlace") })}
                  </button>
                </div>
              )}
              <div className="city-groups">
                {!customCity && grouped.map(([state, cities]) => (
                  <section key={state}>
                    <h3>{state}</h3>
                    <div>
                      {cities.map((name) => (
                        <button
                          key={name}
                          type="button"
                          className={city === name ? "selected" : ""}
                          onClick={() => setCity(name)}
                        >
                          <Icon name="pin" size={18} />
                          <span>{name}</span>
                          {city === name ? <Icon name="check" size={16} /> : null}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <div className="option-grid">
              {BILL_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.label}
                  icon={opt.icon}
                  label={t(opt.labelKey)}
                  selected={bill === opt.label}
                  onClick={() => setBill(opt.label)}
                />
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="option-grid appliances">
              {APPLIANCE_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.label}
                  icon={opt.icon}
                  label={t(opt.labelKey)}
                  selected={appliances.includes(opt.label)}
                  onClick={() =>
                    setAppliances((all) =>
                      all.includes(opt.label) ? all.filter((x) => x !== opt.label) : [...all, opt.label],
                    )
                  }
                />
              ))}
            </div>
          )}

          <div className="setup-actions">
            <Button variant="quiet" disabled={step === 0} onClick={() => setStep(step - 1)}>
              {t("setup.back")}
            </Button>
            <Button
              icon="arrow"
              disabled={!canContinue || saving}
              onClick={() => (step < 4 ? setStep(step + 1) : void finish())}
            >
              {step === 4 ? t("setup.finish") : t("setup.continue")}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
