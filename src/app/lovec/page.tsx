import type { Metadata } from "next";
import LovecLanding from "./landing";

export const metadata: Metadata = {
  title: "Ловец лидов — заявки с Profi в Telegram · Konversus",
  description: "AI следит за новыми заказами на Profi, оценивает заказчика и бюджет и присылает карточку в Telegram за секунды.",
};

export default function LovecPage() {
  return <LovecLanding />;
}
