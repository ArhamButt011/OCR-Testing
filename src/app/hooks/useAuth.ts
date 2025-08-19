import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export const useAuth = (redirectPath: string) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const authenticate = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        router.push(redirectPath);
        return;
      }

      try {
        const res = await fetch("/api/auth/check-role", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          setIsAuthenticated(false);
          localStorage.removeItem("token");
          router.push(redirectPath);
        } else {
          const data = await res.json();
          setUserRole(data.data);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Authentication error:", error);
        setIsAuthenticated(false);
        router.push(redirectPath);
      } finally {
        setLoading(false);
      }
    };

    authenticate();
  }, [redirectPath, router]);

  return { isAuthenticated, userRole, loading };
};

