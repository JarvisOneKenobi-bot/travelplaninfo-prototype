export function AdSenseSlot({ slot }: { slot: string }) {
  return (
    <div className="min-h-[250px] w-full rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex items-center justify-center">
      <div className="text-center p-4">
        <p className="text-sm font-medium text-muted-foreground">AdSense Slot</p>
        <p className="text-xs text-muted-foreground/70">{slot}</p>
        <p className="text-xs text-muted-foreground/50 mt-2">Replace with real AdSense script</p>
      </div>
    </div>
  );
}

export function TravelpayoutsSlot({ type = "hotel", position }: { type?: "hotel" | "flight" | "widget"; position?: string }) {
  const labels = {
    hotel: "Hotel Search Widget",
    flight: "Flight Search",
    widget: "Travel Deal",
  };
  return (
    <div className="min-h-[180px] w-full rounded-lg border-2 border-dashed border-primary/20 bg-primary/5 flex items-center justify-center">
      <div className="text-center p-4">
        <p className="text-sm font-medium text-primary">Travelpayouts</p>
        <p className="text-xs text-muted-foreground">{labels[type]}</p>
        <p className="text-xs text-muted-foreground/50 mt-2">Insert affiliate code</p>
      </div>
    </div>
  );
}
