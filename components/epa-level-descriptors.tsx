import {
  descriptorDescription,
  descriptorHeading,
  parseLevelDescriptors,
} from "@/lib/learning/logbook";

type Props = {
  /** Raw jsonb from epa_definitions.level_descriptors */
  descriptors: unknown;
  className?: string;
};

/**
 * Renders level descriptors that may only have `{ level, name }`
 * (description intentionally omitted in some seeds).
 */
export function EpaLevelDescriptors({ descriptors, className }: Props) {
  const list = parseLevelDescriptors(descriptors);

  if (list.length === 0) {
    return (
      <p className={className ?? "text-sm text-ff-muted"}>
        Level descriptors are not available yet.
      </p>
    );
  }

  return (
    <ul className={className ?? "mt-2 space-y-1.5 text-sm text-ff-text"}>
      {list.map((d, index) => {
        const heading = descriptorHeading(d);
        const description = descriptorDescription(d);
        const key =
          d?.level != null ? `level-${d.level}` : `descriptor-${index}`;
        return (
          <li key={key}>
            <span className="font-semibold text-ff-ink">{heading}</span>
            {description ? (
              <span className="text-ff-muted"> — {description}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
