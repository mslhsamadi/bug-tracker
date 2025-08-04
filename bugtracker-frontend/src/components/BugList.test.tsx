import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/router";
import BugList from "./BugList";
import { getBugs, createBug, updateBug, deleteBug } from "../api/bugs";
import { APP_VERSION } from "../config/app";

jest.mock("next/router", () => ({
  useRouter: jest.fn(),
}));

jest.mock("../api/bugs");

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, className }) => <img src={src} alt={alt} className={className} />,
}));

describe("BugList", () => {
  const mockRouter = {
    query: {},
    pathname: "/",
    replace: jest.fn(),
  };

  const mockBugs = [
    {
      id: 1,
      title: "Bug 1",
      status: "Open",
      priority: "High",
      description: "Test",
    },
    {
      id: 2,
      title: "Bug 2",
      status: "In Progress",
      priority: "Medium",
      description: "Test",
    },
  ];

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    jest.clearAllMocks();
  });

  const renderAndWaitForData = async () => {
    (getBugs as jest.Mock).mockResolvedValue(mockBugs);
    const user = userEvent.setup();
    await act(async () => {
      render(<BugList />);
    });
    await waitFor(() => {
      expect(screen.getByText("All Bugs")).toBeInTheDocument();
    });
    return user;
  };

  describe("Initial Rendering", () => {
    it("should render bug list after loading", async () => {
      await renderAndWaitForData();
      expect(screen.getByText("All Bugs")).toBeInTheDocument();
    });

    it("should show error message if bugs fetch fails", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      (getBugs as jest.Mock).mockRejectedValue(new Error("Failed to fetch"));
      await act(async () => {
        render(<BugList />);
      });
      await waitFor(() => {
        expect(screen.getByText("Error: Failed to fetch bugs")).toBeInTheDocument();
      });
      consoleErrorSpy.mockRestore();
    });
  });

  describe("Bug Operations", () => {
    it("should open add bug modal when clicking Add New Bug", async () => {
      const user = await renderAndWaitForData();
      await act(async () => {
        await user.click(screen.getByRole("button", { name: /add new bug/i }));
      });
      expect(screen.getByRole("heading", { name: /add new bug/i })).toBeInTheDocument();
    });

    it("should handle creating a new bug", async () => {
      const newBug = {
        id: 3,
        title: "New Bug",
        status: "Open",
        priority: "High",
        description: "Test",
      };
      (createBug as jest.Mock).mockResolvedValue(newBug);
      (getBugs as jest.Mock).mockResolvedValue([...mockBugs, newBug]);

      const user = await renderAndWaitForData();

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /add new bug/i }));
      });

      await user.type(screen.getByLabelText("Title"), "New Bug");
      await user.type(screen.getByLabelText("Description"), "Test");

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /add bug/i }));
      });

      expect(createBug).toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith({
        pathname: "/",
        query: { createdBugTitle: "New Bug", showCreateNotification: true },
      });
    });

    it("should handle editing a bug", async () => {
      (getBugs as jest.Mock).mockResolvedValue(mockBugs);
      const user = await renderAndWaitForData();

      await act(async () => {
        await user.click(screen.getAllByRole("button", { name: /edit/i })[0]);
      });

      const titleInput = screen.getByDisplayValue("Bug 1");
      await user.clear(titleInput);
      await user.type(titleInput, "Updated Bug");

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /save changes/i }));
      });

      expect(updateBug).toHaveBeenCalledWith("1", expect.objectContaining({ title: "Updated Bug" }));
    });

    it("should handle deleting a bug", async () => {
      (getBugs as jest.Mock).mockResolvedValue(mockBugs);
      (deleteBug as jest.Mock).mockResolvedValue(undefined);
      (getBugs as jest.Mock).mockResolvedValue([mockBugs[1]]);

      const user = await renderAndWaitForData();

      await act(async () => {
        await user.click(screen.getAllByRole("button", { name: /delete/i })[0]);
      });

      const confirmButton = screen.getAllByRole("button", { name: /delete/i }).pop();
      await act(async () => {
        await user.click(confirmButton);
      });

      expect(deleteBug).toHaveBeenCalledWith("1");
      expect(mockRouter.replace).toHaveBeenCalledWith({
        pathname: "/",
        query: { deletedBugTitle: "Bug 1", showDeleteNotification: true },
      });
    });
  });

  describe("Notifications", () => {
    it("should show success notification after creating bug", async () => {
      mockRouter.query = {
        showCreateNotification: "true",
        createdBugTitle: "New Bug",
      };
      await renderAndWaitForData();
      await waitFor(() => {
        expect(screen.getByText(/successfully created bug "New Bug"/i)).toBeInTheDocument();
      });
    });

    it("should show success notification after deleting bug", async () => {
      mockRouter.query = {
        showDeleteNotification: "true",
        deletedBugTitle: "Bug 1",
      };
      await renderAndWaitForData();
      expect(screen.getByText(/successfully deleted bug/i)).toBeInTheDocument();
    });
  });

  describe("Status and Priority Display", () => {
    it("should display correct status indicators", async () => {
      await renderAndWaitForData();
      expect(screen.getByText("Open")).toHaveClass("bg-red-100");
      expect(screen.getByText("In Progress")).toHaveClass("bg-yellow-100");
    });

    it("should display correct priority indicators", async () => {
      await renderAndWaitForData();
      expect(screen.getByText("High")).toHaveClass("bg-red-100");
      expect(screen.getByText("Medium")).toHaveClass("bg-yellow-100");
    });
  });

  it("displays the correct version number", async () => {
    await act(async () => {
      render(<BugList />);
    });
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();
  });

  it("displays the version number in the header", async () => {
    await act(async () => {
      render(<BugList />);
    });
    const header = screen.getByRole("navigation");
    const versionElement = screen.getByText(`v${APP_VERSION}`);
    expect(header).toContainElement(versionElement);
  });
});
