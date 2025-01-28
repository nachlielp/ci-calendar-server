/// <reference types="@types/google.maps" />

import { CIEvent, CIUser, EventSubscribersData, IAddress } from "./interface";
import { Client, Language } from "@googlemaps/google-maps-services-js";

export function getEventListOfSubscribersData(
  users: CIUser[],
  teacherIds: string[],
  orgIds: string[]
): EventSubscribersData[] {
  const subscribedUsers = users.filter((user: CIUser) => {
    const isTeacherSubscribed = user.subscriptions["teachers"].some(
      (teacherId) => teacherIds.includes(teacherId)
    );
    const isOrgSubscribed = user.subscriptions["orgs"].some((orgId) =>
      orgIds.includes(orgId)
    );
    return isTeacherSubscribed || isOrgSubscribed;
  });

  const userTokenAndCounts = subscribedUsers.map((user) => ({
    token: user.fcm_token,
    unreadCount: user.alerts.filter((alert) => !alert.viewed).length,
  }));

  return userTokenAndCounts;
}

export async function updateIAddressWithEnglishAddress(
  iAddress: IAddress
): Promise<IAddress> {
  const placeId = iAddress.place_id;
  const englishAddress = await getAddressFromGooglePlaceId(placeId);
  return { ...iAddress, en_label: englishAddress };
}

async function getAddressFromGooglePlaceId(placeId: string): Promise<string> {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key is not configured");
  }

  const client = new Client({});

  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: ["formatted_address"],
        language: Language.en,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
      headers: {
        Referer: "http://localhost:3005/",
      },
    });

    if (response.data.result && response.data.result.formatted_address) {
      return response.data.result.formatted_address;
    } else {
      throw new Error("No address found");
    }
  } catch (error) {
    console.error("Error fetching English address:", error);
    throw new Error(`Failed to fetch address: ${error}`);
  }
}

export function fixCIEventSegments(ciEvent: CIEvent): CIEvent {
  const segments = ciEvent.segments;
  const fixedSegments = segments.map((segment) => {
    return {
      ...segment,
      type: segment.type === "jame" ? "jam" : segment.type,
    };
  });
  return { ...ciEvent, segments: fixedSegments };
}
