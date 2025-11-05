
export function getJavaWrapper(): string {
  return `
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class LicenseValidator {
    private static final String VALIDATION_URL = "https://<YOUR_APP_URL>/api/validate";

    public static boolean validate(String key, String discordId, String hwid) {
        HttpClient client = HttpClient.newHttpClient();
        String json = String.format(
            "{\\"key\\":\\"%s\\", \\"discordId\\":\\"%s\\", \\"hwid\\":\\"%s\\"}",
            key, discordId, hwid
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(VALIDATION_URL))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
        try {
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    public static void main(String[] args) {
        boolean isValid = validate("LF-YOUR-KEY", "YOUR_DISCORD_ID", "UNIQUE-HWID-123");
        if (!isValid) {
            System.out.println("Invalid license.");
            System.exit(1);
        }
        System.out.println("License valid!");
    }
}
`;
}

export function getNodeJsWrapper(): string {
    return `
async function validateLicense(key, discordId, hwid) {
  const response = await fetch("https://<YOUR_APP_URL>/api/validate", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, discordId, hwid }),
  });

  if (!response.ok) {
    console.error("Validation failed:", await response.text());
    return false;
  }
  
  const data = await response.json();
  return data.success === true;
}

validateLicense("LF-YOUR-KEY", "YOUR_DISCORD_ID", "UNIQUE-HWID-123")
  .then(isValid => {
    if (!isValid) {
      process.exit(1);
    }
  });
`;
}

export function getPythonWrapper(): string {
    return `
import requests
import sys

def validate_license(key, discord_id, hwid):
    try:
        response = requests.post(
            "https://<YOUR_APP_URL>/api/validate",
            json={"key": key, "discordId": discord_id, "hwid": hwid}
        )
        if response.status_code == 200 and response.json().get("success") == True:
            return True
        else:
            print(f"Validation failed: {response.text}")
            return False
    except Exception as e:
        print(f"Request failed: {e}")
        return False

if not validate_license("LF-YOUR-KEY", "YOUR_DISCORD_ID", "UNIQUE-HWID-123"):
    sys.exit(1)
`;
}
