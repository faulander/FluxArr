import { AlertDialog as AlertDialogPrimitive } from "bits-ui";

import Title from "./alert-dialog-title.svelte";
import Action from "./alert-dialog-action.svelte";
import Cancel from "./alert-dialog-cancel.svelte";
import Footer from "./alert-dialog-footer.svelte";
import Header from "./alert-dialog-header.svelte";
import Overlay from "./alert-dialog-overlay.svelte";
import Content from "./alert-dialog-content.svelte";
import Description from "./alert-dialog-description.svelte";

const Root = AlertDialogPrimitive.Root;
const Trigger = AlertDialogPrimitive.Trigger;
const Portal = AlertDialogPrimitive.Portal;

export {
  Root,
  Title,
  Action,
  Cancel,
  Footer,
  Header,
  Portal,
  Trigger,
  Overlay,
  Content,
  Description,
  //
  Root as AlertDialog,
  Title as AlertDialogTitle,
  Action as AlertDialogAction,
  Cancel as AlertDialogCancel,
  Footer as AlertDialogFooter,
  Header as AlertDialogHeader,
  Portal as AlertDialogPortal,
  Trigger as AlertDialogTrigger,
  Overlay as AlertDialogOverlay,
  Content as AlertDialogContent,
  Description as AlertDialogDescription,
};
