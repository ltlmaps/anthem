import {
  AccountBalancesDocument,
  deriveNetworkFromAddress,
  NETWORKS,
  TransactionsDocument,
  validatorAddressToOperatorAddress,
} from "@anthem/utils";
import Toast from "components/Toast";
import { graphqlSelector } from "graphql/queries";
import Analytics from "lib/analytics-lib";
import ENV from "lib/client-env";
import StorageModule from "lib/storage-lib";
import { EpicSignature } from "modules/root";
import { i18nSelector } from "modules/settings/selectors";
import { combineEpics } from "redux-observable";
import { from, merge } from "rxjs";
import {
  delay,
  filter,
  ignoreElements,
  map,
  mergeMap,
  pluck,
  take,
  tap,
} from "rxjs/operators";
import { getQueryParamsFromUrl, wait } from "tools/generic-utils";
import { validateCosmosAddress } from "tools/validation-utils";
import { isActionOf } from "typesafe-actions";
import { Actions } from "../root-actions";

/** ===========================================================================
 * Epics
 * ============================================================================
 */

const appInitializationEpic: EpicSignature = (action$, state$, deps) => {
  return action$.pipe(
    filter(isActionOf(Actions.initializeApp)),
    tap(() => {
      /**
       * Initialize SegmentAnalytics module.
       */
      Analytics.initialize();
    }),
    map(() => {
      const params = getQueryParamsFromUrl(window.location.search);
      let address = StorageModule.getAddress(params);
      const { tString } = i18nSelector(state$.value);

      // Convert validator address to operator addresses
      if (address.includes("valoper")) {
        address = validatorAddressToOperatorAddress(address);
      }

      const addressError = validateCosmosAddress(address, "", tString);
      let network = NETWORKS.COSMOS; // Default to Cosmos

      if (addressError && address !== "") {
        address = "";
        Toast.danger(
          tString("Invalid address found in URL, redirecting to login page."),
        );
        StorageModule.setAddress("");
      } else if (address !== "") {
        network = deriveNetworkFromAddress(address);
      }

      return Actions.initializeSuccess({
        address,
        network,
      });
    }),
  );
};

const monthlySummaryEmailBannerEpic: EpicSignature = (action$, state$) => {
  return action$.pipe(
    filter(isActionOf([Actions.setAddressSuccess, Actions.initializeSuccess])),
    filter(() => {
      // Make development easier, whatever...
      if (ENV.ENABLE_MOCK_APIS) {
        return true;
      }

      const dismissed = state$.value.app.app.dismissedBannerKeys;
      return !dismissed.has("monthly_summary_newsletter");
    }),
    take(1),
    delay(2500),
    map(() =>
      Actions.toggleNotificationsBanner({
        key: "monthly_summary_newsletter",
        visible: true,
      }),
    ),
  );
};

const monthlySummaryTooltipEpic: EpicSignature = action$ => {
  return action$.pipe(
    filter(isActionOf(Actions.showMonthlySummaryTooltip)),
    filter(Boolean),
    take(1),
    delay(650),
    map(() => Actions.toggleMonthlySummaryTooltip(true)),
  );
};

/**
 * This epic handles scroll to and highlighting the data integrity
 * disclaimer tooltip on the HelpPage when the user clicks the link
 * to learn more about the notification banner disclaimer.
 */
const highlightDataIntegrityHelpLabel: EpicSignature = action$ => {
  // Scroll to the disclaimer when it is made visible.
  const scrollToDisclaimerEpic = action$.pipe(
    filter(isActionOf(Actions.displayDataIntegrityHelpLabel)),
    delay(500),
    tap(() => {
      const disclaimer = document.getElementById(
        "help-page-data-integrity-disclaimer",
      );

      if (disclaimer) {
        disclaimer.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    }),
    delay(500),
    map(() => Actions.toggleDataIntegrityHelpLabel(true)),
  );

  // Dismiss the tooltip after a delay, once it has been scrolled to.
  const dismissTooltipAfterDelay = action$.pipe(
    filter(isActionOf(Actions.toggleDataIntegrityHelpLabel)),
    pluck("payload"),
    filter(Boolean),
    delay(2500),
    map(() => Actions.toggleDataIntegrityHelpLabel(false)),
  );

  return merge(scrollToDisclaimerEpic, dismissTooltipAfterDelay);
};

const dismissNotificationsBannerEpic: EpicSignature = action$ => {
  return action$.pipe(
    filter(isActionOf(Actions.toggleNotificationsBanner)),
    pluck("payload"),
    filter(({ visible }) => !visible),
    tap(({ key }) => StorageModule.handleDismissNotification(key)),
    ignoreElements(),
  );
};

/**
 * Register an email for the Chorus One newsletter.
 *
 * TODO: Make fetch/axios an epic dependency to simplify usage.
 */
const signupNewsletter = async (email: string) => {
  const result = await fetch(`${ENV.SERVER_URL}/api/newsletter`, {
    method: "POST",
    body: JSON.stringify({ email }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (result.status !== 200) {
    throw new Error("Failed to signup for newsletter");
  }
};

const newsletterSignupEpic: EpicSignature = (action$, state$, deps) => {
  return action$.pipe(
    filter(isActionOf(Actions.newsletterSignup)),
    pluck("payload"),
    delay(1000),
    mergeMap(async email => {
      const { tString } = i18nSelector(state$.value);

      try {
        await signupNewsletter(email);

        Toast.success(
          tString(
            "Successfully signed up for the Chorus One newsletter. Please check your email for details.",
          ),
        );
        return Actions.newsletterSignupSuccess();
      } catch (err) {
        Toast.danger(
          tString(
            "Could not register your email. Is your email address typed correctly?",
          ),
        );
        return Actions.newsletterSignupFailure();
      }
    }),
  );
};

const refreshBalanceAndTransactionsEpic: EpicSignature = (
  action$,
  state$,
  deps,
) => {
  return action$.pipe(
    filter(isActionOf(Actions.refreshBalanceAndTransactions)),
    mergeMap(() => {
      return from([1, 2, 3]).pipe(
        delay(500),
        mergeMap(async time => {
          await wait(time * 1000);

          const { client } = deps;
          const { address } = graphqlSelector(state$.value);

          client.query({
            query: AccountBalancesDocument,
            variables: {
              address,
            },
          });

          client.query({
            query: TransactionsDocument,
            variables: {
              address,
            },
          });

          return Actions.refreshBalanceAndTransactionsSuccess();
        }),
      );
    }),
  );
};

/** ===========================================================================
 * Export
 * ============================================================================
 */

export default combineEpics(
  appInitializationEpic,
  newsletterSignupEpic,
  monthlySummaryTooltipEpic,
  highlightDataIntegrityHelpLabel,
  dismissNotificationsBannerEpic,
  monthlySummaryEmailBannerEpic,
  refreshBalanceAndTransactionsEpic,
);
