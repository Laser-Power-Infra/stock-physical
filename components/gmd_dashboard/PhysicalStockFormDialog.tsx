"use client";

import { useCallback, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPhysicalStockAction } from "@/app/actions";
import { useAppSelector } from "@/lib/hooks";
import { selectAllGMDUpdateRows } from "@/lib/gmdUpdateSlice";

const FORM_FIELDS = [
  "l2_valve_type",
  "dimension",
  "l7_dimension",
  "l4_component",
  "l5_material",
  "l6_std",
  "l8_item_category",
] as const;

type FormFieldName = (typeof FORM_FIELDS)[number];

const FIELD_LABELS: Record<string, string> = {
  location: "Location",
  l2_valve_type: "L2 - Valve Type",
  dimension: "Dimension",
  l7_dimension: "L7 - Dimension",
  l4_component: "L4 - Component",
  l5_material: "L5 - Material",
  l6_std: "L6 - STD",
  l8_item_category: "L8 - Item Category",
};

const formSchema = z.object({
  location: z.string(),
  l2_valve_type: z.string(),
  dimension: z.string(),
  l7_dimension: z.string(),
  l4_component: z.string(),
  l5_material: z.string(),
  l6_std: z.string(),
  l8_item_category: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

interface NewItemFormProps {
  onDone: () => void;
}

function NewItemForm({ onDone }: NewItemFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "",
      l2_valve_type: "",
      dimension: "",
      l7_dimension: "",
      l4_component: "",
      l5_material: "",
      l6_std: "",
      l8_item_category: "",
    },
  });

  const {
    l2_valve_type,
    dimension,
    l7_dimension,
    l4_component,
    l5_material,
    l6_std,
  } = useWatch({ control: form.control });

  const allRows = useAppSelector(selectAllGMDUpdateRows);

  const options = useMemo(() => {
    const ancestors: Record<string, string | undefined> = {
      l2_valve_type,
      dimension,
      l7_dimension,
      l4_component,
      l5_material,
      l6_std,
    };
    const result: Record<string, string[]> = {};
    for (let i = 0; i < FORM_FIELDS.length; i++) {
      const field = FORM_FIELDS[i];
      const set = new Set<string>();
      for (const row of allRows) {
        let matches = true;
        for (let j = 0; j < i; j++) {
          const ancestor = ancestors[FORM_FIELDS[j]];
          if (ancestor) {
            const rowValue = (row[FORM_FIELDS[j]] ?? "").trim().toUpperCase();
            if (rowValue !== ancestor) {
              matches = false;
              break;
            }
          }
        }
        if (!matches) continue;
        const value = (row[field] ?? "").trim().toUpperCase();
        if (value) set.add(value);
      }
      result[field] = Array.from(set).sort((a, b) =>
        a.localeCompare(b),
      );
    }
    return result;
  }, [
    allRows,
    l2_valve_type,
    dimension,
    l7_dimension,
    l4_component,
    l5_material,
    l6_std,
  ]);

  const handleSelectChange = useCallback(
    (fieldName: FormFieldName, onChange: (value: string) => void) =>
      (value: string | null) => {
        onChange(value ?? "");
        const index = FORM_FIELDS.indexOf(fieldName);
        FORM_FIELDS.slice(index + 1).forEach((f) =>
          form.setValue(f, "", { shouldDirty: false }),
        );
      },
    [form],
  );

  const clearField = useCallback(
    (fieldName: FormFieldName) => {
      const index = FORM_FIELDS.indexOf(fieldName);
      form.setValue(fieldName, "", { shouldDirty: false });
      FORM_FIELDS.slice(index + 1).forEach((f) =>
        form.setValue(f, "", { shouldDirty: false }),
      );
    },
    [form],
  );

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      const clean: Record<string, string> = {};
      for (const field of ["location", ...FORM_FIELDS] as const) {
        const value = (values[field] ?? "").trim().toUpperCase();
        if (value) clean[field] = value;
      }
      const res = await createPhysicalStockAction(clean);
      if (!res.success) {
        toast.error(res.error || "Failed to create item.");
        return;
      }
      toast.success(`New item created — ERP ${res.erp_code}`);
      onDone();
    },
    [onDone],
  );

  return (
    <form
      id="physical-stock-form"
      onSubmit={form.handleSubmit(handleSubmit)}
      className="flex flex-col gap-4"
    >
      <Controller
        name="location"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="ps-location">Location</FieldLabel>
            <Input
              {...field}
              id="ps-location"
              className="uppercase"
              placeholder="KGP"
              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      {FORM_FIELDS.map((name) => (
        <Controller
          key={name}
          name={name}
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`ps-${name}`}>{FIELD_LABELS[name]}</FieldLabel>
              <div className="flex w-full items-center gap-2">
                <Select
                  name={field.name}
                  value={field.value || null}
                  onValueChange={handleSelectChange(name, field.onChange)}
                >
                  <SelectTrigger
                    id={`ps-${name}`}
                    aria-invalid={fieldState.invalid}
                    className="w-full"
                  >
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="uppercase">
                    {(options[name] ?? []).map((opt) => (
                      <SelectItem key={opt} value={opt} className="uppercase">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {Boolean(field.value) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => clearField(name)}
                    aria-label={`Clear ${FIELD_LABELS[name]}`}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      ))}
    </form>
  );
}

interface PhysicalStockFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function PhysicalStockFormDialog({
  open,
  onOpenChange,
  onCreated,
}: PhysicalStockFormDialogProps) {
  const handleDone = useCallback(() => {
    onCreated();
    onOpenChange(false);
  }, [onCreated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Physical Stock Item</DialogTitle>
          <DialogDescription>
            ERP code is auto-generated and unique. Fields are optional and are
            saved in capitals.
          </DialogDescription>
        </DialogHeader>
        {open && <NewItemForm onDone={handleDone} />}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="physical-stock-form">
            <Plus />
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}